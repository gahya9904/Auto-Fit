import os
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


async def generate_chat_response(question: str) -> str:
    response = await client.responses.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5"),
        instructions="""
        너는 헬스케어 애플리케이션의 AI 챗봇이다.
        사용자의 운동, 식단, 건강 관련 일반적인 질문에
        이해하기 쉽게 답변한다.

        의료 진단이나 처방은 하지 않는다.
        """,
        input=question
    )

    return response.output_text