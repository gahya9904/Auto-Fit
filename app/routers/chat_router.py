import os

from fastapi import APIRouter

from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import generate_chat_response


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@router.post("", response_model=ChatResponse)
async def chat(request: ChatRequest):

    answer = await generate_chat_response(
        request.question
    )

    return ChatResponse(
        answer=answer,
        model=os.getenv("OPENAI_MODEL", "gpt-5")
    )