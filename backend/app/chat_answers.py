"""Natural-language preview orchestration; no message persistence or AI calls."""

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal

from backend.app.chat_health_scores import Assessment, build_score_answer
from backend.app.chat_intents import classify_question
from backend.app.chat_records import record_period


def clarification(message: str, required: str) -> dict:
    return {
        "intent": "clarification", "content": message,
        "response_source": "need_more_data", "needs_more_data": True,
        "evidence": [], "required_data": [required],
    }


@dataclass(frozen=True)
class AnswerDecision:
    # Internal routing metadata, not a new client response or stored DB column.
    route: Literal["database", "clarification", "need_more_data", "ai_required"]
    answer: dict


async def decide_answer(
    content: str, load_scores: Callable[[], Awaitable[list[Assessment]]], load_records=None,
) -> AnswerDecision:
    """Inspect supported DB evidence before considering AI; never call a model.

    Insufficient evidence and unsupported queries must not become AI requests.
    DB failures propagate unchanged instead of triggering a model fallback.
    """
    plan = classify_question(content)
    answer = await _database_answer(content, plan, load_scores, load_records)
    if answer["intent"] == "clarification":
        route = "clarification"
    elif answer.get("needs_more_data", False):
        route = "need_more_data"
    elif plan.requires_explanation and answer.get("evidence"):
        route = "ai_required"
    else:
        route = "database"
    return AnswerDecision(route, answer)


async def answer_question(
    content: str, load_scores: Callable[[], Awaitable[list[Assessment]]], load_records=None,
) -> dict:
    decision = await decide_answer(content, load_scores, load_records)
    if decision.route == "ai_required":
        # No model integration yet: return only verified DB facts, not fake AI.
        return {**decision.answer, "content": decision.answer["content"] +
                " AI 설명 기능은 아직 연결되지 않아 확인된 기록 요약만 안내합니다."}
    return decision.answer


async def _database_answer(content, plan, load_scores, load_records):
    text = "".join(content.split())
    if plan.intent in {"meal_history", "exercise_history"} and load_records is not None:
        if any(word in text for word in ("왜", "이유", "원인", "추천", "어떻게", "괜찮", "뜻", "개선", "삭제", "수정", "변경", "저장", "다른사용자", "다른사람", "계획", "목표", "루틴", "종류", "무슨운동", "단백질", "탄수화물", "지방")):
            return clarification("현재는 본인의 기록 횟수·시간·열량 요약을 조회할 수 있습니다. 추천이나 원인 분석은 아직 지원하지 않습니다.", "record_summary_question")
        period = record_period(content)
        if period is None:
            return clarification("조회 기간을 오늘·어제·이번 주·지난주·최근 7일 중 하나로 알려주세요. 현재는 기간 전체 요약만 지원합니다.", "record_period")
        return await load_records(plan.intent, period)
    if plan.requires_clarification or plan.intent not in {
        "health_score_latest", "health_score_change",
    }:
        return clarification(
            "최근 건강 점수 비교 또는 기간을 지정한 식사·운동 기록 요약에 대해 질문해 주세요.",
            "supported_health_score_question",
        )
    # Do not silently reinterpret a dated or aggregate query as the latest pair.
    if re.search(
        r"\d|오늘|어제|그제|내일|모레|주간|월간|연간|이번|지난주|지난달|작년|올해|작월|"
        r"저번주|저번달|개월|일주일|한달|일년|일주|평균|최고|최저|전체|추이|처음|최초|예측|다음",
        text,
    ):
        return clarification(
            "특정 기간·통계 조회는 아직 지원하지 않습니다. 최근 점수 또는 바로 이전 평가와의 비교로 질문해 주세요.",
            "latest_or_previous_assessment_scope",
        )
    if any(word in text for word in ("삭제", "수정", "바꿔", "변경", "저장", "다른사람", "다른사용자")):
        return clarification(
            "로그인한 본인의 건강 점수 조회만 지원합니다.", "own_score_read_question",
        )
    if any(word in text for word in ("뜻", "정의", "무엇", "뭐야", "계산법", "산출법")):
        return clarification(
            "건강 점수의 정의나 산출 방식 안내는 아직 준비 중입니다. 최근 평가 점수는 조회할 수 있습니다.",
            "score_definition_support",
        )
    rows = await load_scores()
    mode = "change" if plan.intent == "health_score_change" else "latest"
    return build_score_answer(rows, mode, plan.requires_explanation)
