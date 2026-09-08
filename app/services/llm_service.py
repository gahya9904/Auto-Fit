from openai import AsyncOpenAI

from app.core.config import get_settings
from app.schemas.chat import ChatRequest


settings = get_settings()

client = AsyncOpenAI(
    api_key=settings.openai_api_key
)


async def generate_chat_response(request: ChatRequest) -> str:
    history_text = "\n".join(
        f"{message.role}: {message.content}"
        for message in request.chat_history
    )

    prompt = f"""
[사용자 정보]
{request.user_info}

[이전 대화]
{history_text}

[사용자 질문]
{request.question}
"""

    response = await client.responses.create(
        model=settings.openai_model,
        instructions="""
너는 헬스케어 애플리케이션의 AI 챗봇이다.

사용자의 운동, 식단, 건강 관련 일반적인 질문에
간결하고 이해하기 쉽게 답변한다.

의료 진단이나 처방은 하지 않는다.
""",
        input=prompt,
    )

    return response.output_text