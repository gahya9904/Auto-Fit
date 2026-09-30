from typing import Any

from app.services.feature_selector_service import (
    feature_selector_service,
)

from app.services.ocr_analysis_adapter import (
    normalize_ocr_result,
)


class AnalysisInputService:

    # --------------------------------------------------
    # 일반 분석 입력 생성
    # --------------------------------------------------

    def build_inputs(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        FeatureSelectorService를 통해 생성된
        안전한 분석 입력값을 각 모듈별로 정리한다.

        현재 생성되는 입력:
        - rule_engine_input
        - rag_input
        - unsupported_fields

        개인정보 및 보안정보는 포함하지 않는다.
        """

        safe_inputs = (
            feature_selector_service
            .build_safe_analysis_inputs(
                payload
            )
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

    # --------------------------------------------------
    # OCR 결과 → 기존 분석 입력 흐름 연결
    # --------------------------------------------------

    def build_inputs_from_ocr(
        self,
        document_type: str,
        extracted_data: dict[str, Any] | None,
    ) -> dict[str, Any]:
        """
        OCR 결과를 Auto-Fit 내부 표준 데이터로 변환한 뒤
        기존 FeatureSelectorService 기반 분석 흐름에 연결한다.

        Backend / OCR API 계약은 변경하지 않는다.
        """

        body_data, health_data = normalize_ocr_result(
            document_type=document_type,
            extracted_data=extracted_data,
        )

        payload: dict[str, Any] = {}

        if body_data is not None:
            payload["body_data"] = (
                body_data.model_dump(
                    exclude_none=False
                )
            )

        if health_data is not None:
            payload["health_data"] = (
                health_data.model_dump(
                    exclude_none=False
                )
            )

        return self.build_inputs(
            payload
        )


analysis_input_service = (
    AnalysisInputService()
)