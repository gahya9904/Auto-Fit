"""Read an owner-scoped main analysis, with a verified-data draft fallback."""

from datetime import UTC, datetime
from typing import Any, Callable
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from backend.app.analysis_popups import POPUP_METRIC_KEYS, PopupResponse, fetch_popup_data

METRIC_NAMES = {
    "bmi": "BMI", "weight_kg": "체중", "body_fat_mass_kg": "체지방량",
    "body_fat_percentage": "체지방률", "skeletal_muscle_mass_kg": "골격근량",
    "fasting_glucose": "공복혈당", "systolic_bp": "수축기 혈압", "diastolic_bp": "이완기 혈압",
}
METRIC_ORDER = {key: index for index, key in enumerate((
    "body_fat_percentage", "skeletal_muscle_mass_kg", "fasting_glucose",
    "bmi", "systolic_bp", "diastolic_bp", "weight_kg", "body_fat_mass_kg",
))}


class DisplayText(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)


class AnalysisSummary(DisplayText):
    description: str = Field(min_length=1, max_length=2000)


class AnalysisGoal(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=500)


class AnalysisStrategy(DisplayText):
    tags: list[str] = Field(min_length=1, max_length=8)
    message: str = Field(min_length=1, max_length=1000)


class RecommendationReason(DisplayText):
    description: str = Field(min_length=1, max_length=2000)
    evidence_metric_keys: list[str] = Field(default_factory=list, max_length=8)


class FinalDirection(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    from_: str = Field(alias="from", min_length=1, max_length=500)
    to: str = Field(min_length=1, max_length=500)


class MainAnalysis(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    headline: DisplayText
    summary: AnalysisSummary
    goal: AnalysisGoal
    strategy: AnalysisStrategy
    key_metric_keys: list[str] = Field(min_length=1, max_length=3)
    recommendation_reasons: list[RecommendationReason] = Field(min_length=1, max_length=10)
    final_direction: FinalDirection

    @model_validator(mode="after")
    def validate_metric_references(self):
        groups = [self.key_metric_keys] + [reason.evidence_metric_keys for reason in self.recommendation_reasons]
        if any(len(keys) != len(set(keys)) or any(key not in POPUP_METRIC_KEYS for key in keys) for keys in groups):
            raise ValueError("Analysis metric references must match popup metric keys")
        return self


class MainAnalysisResponse(MainAnalysis):
    assessment_id: UUID


def attach_main_analysis(raw_result: dict, analysis: MainAnalysis | dict) -> dict:
    """Prepare a validated result for an assessment writer's existing transaction."""
    if not isinstance(raw_result, dict):
        raise ValueError("raw_result must be an object")
    validated = MainAnalysis.model_validate(analysis)
    return {**raw_result, "total_analysis": validated.model_dump(
        mode="json", by_alias=True, include=set(MainAnalysis.model_fields),
    )}


def build_draft_analysis(assessment: dict, popup: PopupResponse) -> MainAnalysisResponse | None:
    """Use only confirmed assessment-time criteria for provisional screen copy."""
    if str(popup.assessment_id) != str(assessment.get("health_assessment_id")):
        return None
    snapshot = assessment.get("input_snapshot")
    if not isinstance(snapshot, dict):
        return None
    goal = snapshot.get("goal")
    if not isinstance(goal, dict) or not isinstance(goal.get("text"), str):
        return None
    goal_text = goal["text"].strip()
    if not goal_text or len(goal_text) > 500:
        return None
    eligible = [m for m in popup.metrics if m.display_value is not None and m.criteria_id
                and m.source_ids and m.status in {"low", "normal", "caution", "high"}]
    if not eligible:
        return None
    eligible.sort(key=lambda m: (0 if m.status in {"low", "high"} else 1 if m.status == "caution" else 2,
                                 METRIC_ORDER.get(m.key, 99)))
    important = eligible[:3]
    by_key = {m.key: m for m in eligible}
    special = (goal.get("goal_type") == "weight_loss" and goal.get("short_term") is True
               and by_key.get("body_fat_percentage") and by_key["body_fat_percentage"].status == "high"
               and by_key.get("skeletal_muscle_mass_kg") and by_key["skeletal_muscle_mass_kg"].status == "low"
               and by_key.get("fasting_glucose") and by_key["fasting_glucose"].status == "caution")
    if special:
        important = [by_key[key] for key in ("body_fat_percentage", "skeletal_muscle_mass_kg", "fasting_glucose")]
        reasons = [
            RecommendationReason(title="체중 외 지표도 살펴봤어요",
                                 description="체지방률과 골격근량의 판정을 함께 확인했어요.",
                                 evidence_metric_keys=["body_fat_percentage", "skeletal_muscle_mass_kg"]),
            RecommendationReason(title="공복혈당도 함께 확인했어요",
                                 description="공복혈당에 주의 판정이 적용돼 식사·활동 계획을 검토할 때 참고해요.",
                                 evidence_metric_keys=["fasting_glucose"]),
        ]
        summary = AnalysisSummary(title="이번 분석에서는 체성분과 공복혈당을 함께 확인했어요",
                                  description="체지방률은 높음, 골격근량은 낮음, 공복혈당은 주의로 평가됐어요. 각 판정에 적용된 기준도 확인할 수 있어요.")
        strategy = AnalysisStrategy(title="체성분과 공복혈당을 함께 고려한 감량 방향",
                                    tags=["체성분 확인", "근육량 확인", "식사·활동 점검"],
                                    message="목표 기간과 이번 측정 결과를 함께 보고 실행 계획을 정해요.")
        direction = "측정 결과를 함께 고려한 감량 계획"
    else:
        relevant = [m for m in important if m.status != "normal"] or important[:1]
        reasons = [RecommendationReason(
            title=f"{METRIC_NAMES.get(m.key, m.key)} 판정을 확인했어요",
            description=f"{METRIC_NAMES.get(m.key, m.key)}은 {m.status_label}으로 평가됐어요. 적용된 기준을 함께 확인해요.",
            evidence_metric_keys=[m.key],
        ) for m in relevant]
        summary = AnalysisSummary(title="이번 분석에서 확인된 지표를 살펴봐요",
                                  description=" · ".join(f"{METRIC_NAMES.get(m.key, m.key)} {m.status_label}" for m in important))
        strategy = AnalysisStrategy(title="확인된 지표를 함께 고려한 목표 점검",
                                    tags=["평가 결과 확인", "목표 점검"],
                                    message="평가 당시 목표와 확인된 지표를 함께 살펴봐요.")
        direction = "확인된 지표를 함께 고려한 계획"
    return MainAnalysisResponse(
        assessment_id=assessment["health_assessment_id"],
        headline=DisplayText(title="목표는 이어가되, 현재 상태를 함께 살펴봐요"),
        summary=summary, goal=AnalysisGoal(text=goal_text), strategy=strategy,
        key_metric_keys=[m.key for m in important], recommendation_reasons=reasons,
        final_direction=FinalDirection.model_validate({"from": goal_text, "to": direction}),
    )


async def fetch_main_analysis(user_id: str, settings: Any) -> MainAnalysisResponse:
    key = settings.supabase_service_role_key
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    try:
        async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
            response = await client.get(
                f"{settings.supabase_url}/rest/v1/health_assessments",
                headers=headers,
                params={
                    "select": "health_assessment_id,input_snapshot,raw_result",
                    "user_id": f"eq.{user_id}",
                    "assessed_at": f"lte.{datetime.now(UTC).isoformat()}",
                    "order": "assessed_at.desc,health_assessment_id.desc",
                    "limit": "1",
                },
            )
            response.raise_for_status()
            rows = response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(502, detail="건강 분석 자료를 조회하지 못했습니다.") from None
    if not isinstance(rows, list) or len(rows) > 1 or any(not isinstance(row, dict) for row in rows):
        raise HTTPException(502, detail="건강 분석 자료 형식을 확인할 수 없습니다.")
    if not rows:
        raise HTTPException(404, detail="건강 평가를 찾을 수 없습니다.")
    row = rows[0]
    result = row.get("raw_result")
    if not isinstance(result, dict):
        raise HTTPException(502, detail="건강 분석 자료 형식을 확인할 수 없습니다.")
    saved = result.get("total_analysis")
    if saved is None:
        try:
            assessment_id = UUID(str(row.get("health_assessment_id")))
        except (TypeError, ValueError):
            raise HTTPException(502, detail="건강 분석 자료 형식을 확인할 수 없습니다.") from None
        popup = await fetch_popup_data(assessment_id, user_id, settings)
        draft = build_draft_analysis(row, popup)
        if draft is None:
            raise HTTPException(404, detail="종합 분석 결과가 아직 없습니다.")
        return draft
    if not isinstance(saved, dict):
        raise HTTPException(502, detail="종합 분석 결과 형식을 확인할 수 없습니다.")
    try:
        return MainAnalysisResponse.model_validate({**saved, "assessment_id": row.get("health_assessment_id")})
    except ValidationError:
        raise HTTPException(502, detail="종합 분석 결과 형식을 확인할 수 없습니다.") from None


def create_analysis_summary_router(current_user_dependency: Callable, settings_dependency: Callable) -> APIRouter:
    router = APIRouter(prefix="/api/health-assessments", tags=["Health Analysis"], dependencies=[Depends(HTTPBearer(auto_error=False))])

    @router.get(
        "/latest", response_model=MainAnalysisResponse, summary="최신 종합 건강 분석 결과 조회",
        responses={401: {"description": "로그인 필요"}, 404: {"description": "평가 또는 생성 가능한 종합 분석 없음"},
                   502: {"description": "자료 조회 또는 저장 형식 오류"}},
    )
    async def latest_analysis(user: Any = Depends(current_user_dependency), settings: Any = Depends(settings_dependency)):
        return await fetch_main_analysis(user.id, settings)

    return router
