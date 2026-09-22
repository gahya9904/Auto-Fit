from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
)

from app.core.security import (
    security,
    verify_api_key,
)

from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
)

from app.services.feature_selector_service import (
    feature_selector_service,
)

from app.graphs.analysis_graph import (
    analysis_graph,
)

from app.services.analysis_input_service import (
    analysis_input_service,
)


router = APIRouter(
    prefix="/analysis",
    tags=["analysis"],
)


@router.post(
    "",
    response_model=AnalysisResponse,
)
async def analyze_health(
    request: AnalysisRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
):
    verify_api_key(credentials)

    try:
        # --------------------------------------------------
        # 1. 요청 데이터 dict 변환
        # --------------------------------------------------

        raw_payload = request.model_dump()

        # --------------------------------------------------
        # 2. Privacy + Feature Selector
        # --------------------------------------------------

        safe_inputs = (
            feature_selector_service
            .build_safe_analysis_inputs(
                raw_payload
            )
        )

        safe_health_data = safe_inputs[
            "safe_health_data"
        ]

        # --------------------------------------------------
        # 3. body / health 데이터 분리
        # --------------------------------------------------

        body_fields = {
            "age",
            "age_group",
            "gender",
            "height_cm",
            "weight_kg",
            "bmi",
            "body_fat_percentage",
            "skeletal_muscle_mass_kg",
            "visceral_fat_level",
            "waist_hip_ratio",
            "basal_metabolic_rate",
        }

        health_fields = {
            "systolic_bp",
            "diastolic_bp",
            "fasting_glucose",
            "hba1c",
            "total_cholesterol",
            "ldl",
            "hdl",
            "triglyceride",
            "ast",
            "alt",
            "gamma_gtp",
            "creatinine",
        }

        safe_body_data = {
            key: value
            for key, value in safe_health_data.items()
            if key in body_fields
        }

        safe_health_check_data = {
            key: value
            for key, value in safe_health_data.items()
            if key in health_fields
        }

        # --------------------------------------------------
        # 4. LangGraph 실행
        # --------------------------------------------------

        graph_result = await analysis_graph.ainvoke(
            {
                "body_data": safe_body_data,
                "health_data": safe_health_check_data,
                "rule_engine_input": safe_inputs[
                    "rule_engine_input"
                ],
                "rag_input": safe_inputs[
                    "rag_input"
                ],
                "warnings": [],
            }
        )

        # --------------------------------------------------
        # 5. Rule Engine 결과
        # --------------------------------------------------

        rule_result = graph_result.get(
            "rule_engine_result",
            {},
        )

        body_analysis = rule_result.get(
            "body_analysis",
            {},
        )

        health_analysis = rule_result.get(
            "health_analysis",
            {},
        )

        # --------------------------------------------------
        # 6. RAG + LLM 최종 결과
        # --------------------------------------------------

        final_answer = graph_result.get(
            "final_answer",
            {},
        )

        # --------------------------------------------------
        # 7. 경고 메시지
        # --------------------------------------------------

        warnings = graph_result.get(
            "warnings",
            [],
        )

        unsupported_fields = safe_inputs[
            "unsupported_fields"
        ]

        if unsupported_fields:
            warnings.append(
                "일부 입력 필드는 현재 분석에서 사용되지 않았습니다."
            )

        # --------------------------------------------------
        # 8. 최종 응답
        # --------------------------------------------------

        return AnalysisResponse(
            user_id=None,
            body_analysis=body_analysis,
            health_analysis=health_analysis,
            final_answer=final_answer or None,
            warnings=warnings,
            analysis_version="langgraph-v1",
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Health analysis failed",
        )


# --------------------------------------------------
# 개발용 안전 입력 확인 API
# --------------------------------------------------

@router.post("/debug-inputs")
async def debug_analysis_inputs(
    request: AnalysisRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
):
    verify_api_key(credentials)

    try:
        raw_payload = request.model_dump()

        safe_inputs = analysis_input_service.build_inputs(
            raw_payload
        )

        return {
            "rule_engine_input": safe_inputs[
                "rule_engine_input"
            ],
            "rag_input": safe_inputs[
                "rag_input"
            ],
            "unsupported_fields": safe_inputs[
                "unsupported_fields"
            ],
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Failed to prepare safe analysis inputs",
        )