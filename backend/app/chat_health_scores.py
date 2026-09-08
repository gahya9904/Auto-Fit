"""Read-only score answers, shared by the preview and future chat storage flow."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Literal

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, Field, ValidationError, field_validator


class Assessment(BaseModel):
    overall_score: Decimal = Field(ge=0, le=100)
    assessed_at: datetime

    @field_validator("assessed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Assessment date requires a timezone")
        return value


async def fetch_scores(url: str, headers: dict, user_id: str) -> list[Assessment]:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{url}/rest/v1/health_assessments",
                headers=headers,
                params={
                    "select": "overall_score,assessed_at",
                    "user_id": f"eq.{user_id}",
                    "assessed_at": f"lte.{datetime.now(UTC).isoformat()}",
                    "order": "assessed_at.desc,health_assessment_id.desc",
                    "limit": "2",
                },
            )
            response.raise_for_status()
            rows = response.json()
            if not isinstance(rows, list):
                raise ValueError("Expected assessment list")
            return [Assessment.model_validate(row) for row in rows]
    except (httpx.HTTPError, ValueError, ValidationError):
        raise HTTPException(502, detail={
            "code": "DATA_SOURCE_ERROR",
            "message": "건강 점수를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.",
            "fields": None,
        }) from None


def build_score_answer(
    rows: list[Assessment], mode: Literal["latest", "change"], explain: bool = False,
) -> dict:
    answer = {
        "content": "", "intent": f"health_score_{mode}",
        "response_source": "database", "needs_more_data": False,
        "evidence": [], "required_data": [],
    }
    if not rows:
        answer["content"] = "저장된 건강 평가가 없습니다. 건강 데이터를 업로드하고 평가를 완료해 주세요."
        answer["required_data"] = ["health_assessment"]
    else:
        current = rows[0]
        previous = rows[1] if mode == "change" and len(rows) > 1 else None
        answer["evidence"] = [{
            "metric": "health_score", "label": "건강 점수",
            "current_value": float(current.overall_score),
            "previous_value": float(previous.overall_score) if previous else None,
            "unit": "점", "measured_at": current.assessed_at.isoformat(),
        }]
        answer["content"] = f"최근 평가({current.assessed_at.isoformat()})의 건강 점수는 {current.overall_score:g}점입니다."
        if mode == "change":
            if previous:
                delta = current.overall_score - previous.overall_score
                change = "동일합니다" if delta == 0 else f"{abs(delta):g}점 {'높아졌습니다' if delta > 0 else '낮아졌습니다'}"
                answer["content"] += f" 이전 평가({previous.assessed_at.isoformat()})의 {previous.overall_score:g}점과 비교해 {change}."
            else:
                answer["content"] += " 비교할 이전 평가가 없습니다."
                answer["required_data"].append("previous_health_assessment")
        if explain:
            answer["content"] += " 점수만으로 원인이나 개선 방법을 판단할 수 없습니다. 평가 항목별 근거 확인이 필요합니다."
            answer["required_data"].append("assessment_explanation_evidence")
    if answer["required_data"]:
        answer.update(response_source="need_more_data", needs_more_data=True)
    return answer
