"""OpenAI adapter used by the authenticated chat router."""

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import ChatRequest
from app.services.privacy_service import privacy_service


SYSTEM_INSTRUCTIONS = """
너는 Auto-Fit 헬스케어 애플리케이션의 AI 챗봇이다.

사용자의 운동, 식단, 건강 관련 일반적인 질문에
정확하고 이해하기 쉽게 한국어로 답변한다.

- 운동, 식단, 건강 질문에는 일반적인 교육 정보를 제공한다.
- 특별히 자세한 설명을 요청하지 않는 경우 핵심 내용 위주로
  3~5문장 정도로 간결하게 답변한다.
- 의료 진단이나 처방을 하지 않는다.
- 불법적이거나 위험한 요청은 적절히 거절한다.
- 사용자의 개인정보, 인증정보, 보안정보를 답변에 노출하거나
  재구성하지 않는다.
- 제공되지 않은 개인정보를 추측하거나 생성하지 않는다.
""".strip()


def build_prompt(
    request: ChatRequest,
) -> str:
    """
    OpenAI에 전달하기 전에 질문과 최근 대화를
    개인정보 필터링한다.
    """

    # 최근 메시지 6개만 사용
    recent_history = request.chat_history[-6:]

    # 사용자 질문 개인정보 필터링
    safe_question = privacy_service.sanitize_text(
        request.question
    )

    # 이전 대화 개인정보 필터링
    safe_history: list[str] = []

    for message in recent_history:
        safe_content = privacy_service.sanitize_text(
            message.content
        )

        safe_history.append(
            f"{message.role}: {safe_content}"
        )

    history_text = "\n".join(
        safe_history
    )

    prompt = f"""
[최근 대화]
{history_text}

[사용자 질문]
{safe_question}
"""

    return prompt.strip()


def get_openai_client() -> AsyncOpenAI:
    """
    환경변수를 확인한 뒤 OpenAI Client를 생성한다.
    """

    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured"
        )

    return AsyncOpenAI(
        api_key=settings.openai_api_key
    )


async def generate_chat_response(
    request: ChatRequest,
) -> str:
    """
    일반 챗봇 응답 생성
    """

    settings = get_settings()
    client = get_openai_client()

    prompt = build_prompt(request)

    response = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=prompt,
        max_output_tokens=300,
    )

    answer = response.output_text.strip()

    if not answer:
        raise RuntimeError(
            "AI returned an empty answer"
        )

    return answer


async def stream_chat_response(
    request: ChatRequest,
):
    """
    스트리밍 챗봇 응답 생성
    """

    settings = get_settings()
    client = get_openai_client()

    prompt = build_prompt(request)

    stream = await client.responses.create(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=prompt,
        max_output_tokens=300,
        stream=True,
    )

    async for event in stream:
        if event.type == "response.output_text.delta":
            yield event.delta