import json
import re
from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings

from app.graphs.nodes.rag_node import (
    rag_node,
)

from app.services.diet_context_service import (
    build_diet_safety_tags,
)

from app.services.exercise_context_service import (
    build_exercise_safety_tags,
)


# =========================================================
# System Prompt
# =========================================================


SYSTEM_INSTRUCTIONS = """
너는 Auto-Fit 헬스케어 애플리케이션의 AI 챗봇이다.

사용자의 건강관리, 운동, 식단 관련 질문에
간결하고 이해하기 쉬운 한국어로 답변한다.

반드시 다음 규칙을 따른다.

[의료 안전]
- 특정 질환을 확정 진단하지 않는다.
- 사용자가 특정 질병을 가지고 있다고 단정하지 않는다.
- 약물 복용 시작/중단/변경을 지시하지 않는다.
- 의료 처치를 대신하지 않는다.
- 필요한 경우 의료진 상담을 권고한다.

[개인정보]
- 개인정보를 추측하지 않는다.
- 이름, 연락처, 이메일, 주민번호, 주소 등을 출력하거나 추론하지 않는다.
- 원본 건강 수치를 임의로 생성하거나 추측하지 않는다.
- 외부 LLM에는 상태 분류 또는 일반화된 관리 tag만 제공된 것으로 이해한다.

[건강 정보]
- 건강 관련 설명은 가능한 경우 검증된 RAG 자료를 기반으로 한다.
- RAG에 없는 의학적 사실을 과도하게 생성하지 않는다.
- 사용자의 모든 건강 상태를 불필요하게 나열하지 않는다.
- 질문과 직접 관련된 내용만 설명한다.

[운동]
- 저장된 Auto-Fit 운동 추천이 있으면 이를 우선 사용한다.
- 저장된 운동 계획이 있는데 새로운 운동계획을 임의로 다시 만들지 않는다.
- 건강 안전 조건보다 사용자 선호를 우선하지 않는다.

[식단]
- 저장된 Auto-Fit 주간 식단이 있으면 이를 우선 사용한다.
- 기존 식단 조회 질문에는 새로운 식단을 임의 생성하지 않는다.
- 식단 변경 요청은 별도의 replace-meal 기능에서 처리한다.

[응답 스타일]
- 기본적으로 짧고 명확하게 답한다.
- 불필요하게 긴 의학 설명을 하지 않는다.
- 사용자가 쉽게 이해할 수 있는 표현을 사용한다.
- "원본 검사 수치가 없다"는 표현을 사용하지 않는다.
""".strip()


# =========================================================
# OpenAI Client
# =========================================================


def _get_client() -> AsyncOpenAI:
    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured."
        )

    return AsyncOpenAI(
        api_key=settings.openai_api_key
    )


# =========================================================
# Privacy
# =========================================================


def _sanitize_message(
    text: str,
) -> str:
    """
    외부 LLM으로 전달하기 전
    기본적인 개인정보 패턴을 제거한다.

    주의:
    사용자 질문 내용 자체를 로그에 남기지 않는다.
    """

    result = text.strip()

    # Email
    result = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[EMAIL]",
        result,
    )

    # Korean phone number
    result = re.sub(
        r"\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b",
        "[PHONE]",
        result,
    )

    # Resident registration number pattern
    result = re.sub(
        r"\b\d{6}[-\s]?[1-4]\d{6}\b",
        "[IDENTIFIER]",
        result,
    )

    return result[:1000]


# =========================================================
# Context Minimization
# =========================================================


def _safe_context_dict(
    value: dict | None,
    max_chars: int,
) -> dict:
    """
    Backend가 전달한 저장 결과가 너무 큰 경우
    OpenAI로 보내는 context 크기를 제한한다.
    """

    if not value:
        return {}

    raw = json.dumps(
        value,
        ensure_ascii=False,
    )

    if len(raw) <= max_chars:
        return value

    return {
        "summary": raw[:max_chars]
    }


def _build_safe_rag_context(
    rag_context: list[dict],
) -> list[dict]:
    """
    RAG context에서 필요한 정보만 전달한다.
    """

    safe_context: list[dict] = []

    for item in rag_context:
        safe_context.append(
            {
                "content": str(
                    item.get(
                        "content",
                        "",
                    )
                )[:1500],

                "source_org": item.get(
                    "source_org"
                ),

                "title": item.get(
                    "title"
                ),

                "topic": item.get(
                    "topic"
                ),
            }
        )

    return safe_context


# =========================================================
# Health
# =========================================================


async def answer_health_question(
    message: str,
    metric_statuses: dict[str, str],
) -> str:
    """
    건강 질문:
    metric_statuses -> RAG -> LLM
    """

    settings = get_settings()

    safe_message = _sanitize_message(
        message
    )

    # -----------------------------------------------------
    # RAG
    # -----------------------------------------------------

    rag_result = await rag_node(
        {
            "merged_analysis": {
                "metric_statuses": metric_statuses
            },
            "warnings": [],
        }
    )

    safe_rag_context = (
        _build_safe_rag_context(
            rag_result.get(
                "rag_context",
                [],
            )
        )
    )

    # -----------------------------------------------------
    # Raw status 대신 일반화된 관리 tag
    # -----------------------------------------------------

    health_tags = build_diet_safety_tags(
        metric_statuses
    )

    payload = {
        "question": safe_message,

        "health_management_tags": (
            health_tags
        ),

        "rag_context": (
            safe_rag_context
        ),
    }

    client = _get_client()

    response = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
사용자의 건강 관련 질문에 답변하세요.

규칙:
- health_management_tags는 사용자의 건강 상태를 일반화한 관리 조건입니다.
- 상태 tag를 특정 질병 진단으로 바꾸지 마세요.
- 가능한 경우 rag_context의 공식 근거를 사용하세요.
- 질문과 관계없는 건강 정보를 나열하지 마세요.
- 답변은 3~6문장 정도로 간결하게 작성하세요.

입력:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
""".strip(),
        max_output_tokens=700,
    )

    return response.output_text.strip()


# =========================================================
# Exercise
# =========================================================


async def answer_exercise_question(
    message: str,
    metric_statuses: dict[str, str],
    exercise_summary: dict | None,
) -> str:
    """
    저장된 운동추천을 우선 활용한다.
    """

    settings = get_settings()

    safety_tags = (
        build_exercise_safety_tags(
            metric_statuses
        )
    )

    payload = {
        "question": _sanitize_message(
            message
        ),

        "exercise_safety_tags": (
            safety_tags
        ),

        "stored_exercise_recommendation": (
            _safe_context_dict(
                exercise_summary,
                max_chars=8000,
            )
        ),
    }

    client = _get_client()

    response = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
사용자의 운동 관련 질문에 답변하세요.

규칙:
- stored_exercise_recommendation이 존재하면 반드시 이를 우선 활용하세요.
- 전체 운동계획을 다시 생성하지 마세요.
- 사용자가 질문한 부분만 답하세요.
- exercise_safety_tags를 안전 조건으로 사용하세요.
- 저장된 운동추천이 없다면 일반적인 안전 범위의 안내만 제공하세요.
- 답변은 간결하게 작성하세요.

입력:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
""".strip(),
        max_output_tokens=700,
    )

    return response.output_text.strip()


# =========================================================
# Diet
# =========================================================


async def answer_diet_question(
    message: str,
    metric_statuses: dict[str, str],
    diet_summary: dict | None,
) -> str:
    """
    Backend DB에 저장된 주간 식단을 우선 활용한다.
    """

    settings = get_settings()

    safety_tags = build_diet_safety_tags(
        metric_statuses
    )

    payload = {
        "question": _sanitize_message(
            message
        ),

        "diet_safety_tags": (
            safety_tags
        ),

        "stored_weekly_diet": (
            _safe_context_dict(
                diet_summary,
                max_chars=14000,
            )
        ),
    }

    client = _get_client()

    response = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
사용자의 식단 관련 질문에 답변하세요.

규칙:
- stored_weekly_diet가 존재하면 반드시 이를 우선 사용하세요.
- 저장된 식단을 조회하는 질문에는 새로운 메뉴를 만들지 마세요.
- 사용자가 특정 식단을 변경해 달라는 요청은 여기서 처리하지 마세요.
- diet_safety_tags는 건강관리 안전 조건입니다.
- 사용자가 물어본 식사나 메뉴만 간결하게 설명하세요.

예:
"화요일 저녁 뭐야?"
→ stored_weekly_diet의 화요일 dinner를 설명

"이번 주 간식 뭐야?"
→ 각 요일 snack을 간단하게 정리

입력:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
""".strip(),
        max_output_tokens=800,
    )

    return response.output_text.strip()


# =========================================================
# General
# =========================================================


async def answer_general_chat(
    message: str,
) -> str:
    """
    건강/운동/식단 기능과 무관한 일반 대화.
    """

    settings = get_settings()

    client = _get_client()

    safe_message = _sanitize_message(
        message
    )

    response = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
사용자의 일반적인 질문에 자연스럽고 짧게 답변하세요.

입력:

{safe_message}
""".strip(),
        max_output_tokens=500,
    )

    return response.output_text.strip()