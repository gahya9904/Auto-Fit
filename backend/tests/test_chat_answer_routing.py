import asyncio

import pytest
from fastapi import HTTPException

from backend.app.chat_answers import answer_question, decide_answer
from backend.app.chat_health_scores import Assessment


async def forbidden(*args):
    pytest.fail("unexpected database lookup")


def summary(missing=False):
    return {"intent": "exercise_history", "content": "기록된 운동은 2회입니다.",
            "response_source": "need_more_data" if missing else "database",
            "needs_more_data": missing,
            "evidence": [] if missing else [{"metric": "exercise_sessions", "current_value": 2}],
            "required_data": ["exercise_record"] if missing else []}


@pytest.mark.parametrize("question,route", [
    ("이번 주 운동 몇 번 했어?", "database"),
    ("이번 주 운동 기록을 쉽게 설명해줘", "ai_required"),
    ("이번 주 운동 기록 해석해줘", "ai_required"),
])
def test_routes_after_loading_db(question, route):
    calls = []

    async def records(intent, period):
        calls.append((intent, period))
        return summary()

    decision = asyncio.run(decide_answer(question, forbidden, records))
    assert len(calls) == 1
    assert calls[0][0] == "exercise_history" and calls[0][1]
    assert decision.route == route
    assert decision.answer["response_source"] == "database"


def test_missing_records_take_priority_over_ai():
    async def records(*args):
        return summary(missing=True)

    decision = asyncio.run(decide_answer("이번 주 운동 기록 설명해줘", forbidden, records))
    assert decision.route == "need_more_data"
    assert decision.answer["required_data"] == ["exercise_record"]


@pytest.mark.parametrize("question", [
    "운동 기록 설명해줘", "그건 왜 그래?", "오늘 운동 추천해줘",
    "다른 사용자 운동 기록 설명해줘", "오늘 운동 기록 삭제해줘",
    "건강 점수와 운동 기록 설명해줘", "최근 혈압 설명해줘",
])
def test_unsupported_or_ambiguous_requests_never_reach_ai(question):
    decision = asyncio.run(decide_answer(question, forbidden, forbidden))
    assert decision.route == "clarification"
    assert decision.answer["evidence"] == []


def test_score_cause_without_evidence_does_not_reach_ai():
    async def scores():
        return [Assessment(overall_score=86, assessed_at="2026-09-08T00:00:00Z"),
                Assessment(overall_score=91, assessed_at="2026-09-01T00:00:00Z")]

    decision = asyncio.run(decide_answer("최근 건강 점수가 낮아진 이유는?", scores))
    assert decision.route == "need_more_data"
    assert "assessment_explanation_evidence" in decision.answer["required_data"]


def test_no_model_returns_db_facts_with_explicit_notice():
    async def records(*args):
        return summary()

    result = asyncio.run(answer_question("이번 주 운동 기록 설명해줘", forbidden, records))
    assert result["response_source"] == "database"
    assert not result["needs_more_data"]
    assert result["evidence"] == summary()["evidence"]
    assert "아직 연결되지 않아" in result["content"]
    assert set(result) == set(summary())


def test_database_error_is_not_ai_fallback():
    async def unavailable(*args):
        raise HTTPException(502, detail={"code": "DATA_SOURCE_ERROR"})

    with pytest.raises(HTTPException) as error:
        asyncio.run(decide_answer("이번 주 운동 기록 설명해줘", forbidden, unavailable))
    assert error.value.status_code == 502
