from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import security, verify_api_key
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import generate_chat_response
from app.core.config import get_settings

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)

settings = get_settings()

@router.post(
    "",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    verify_api_key(credentials)

    try:
        answer = await generate_chat_response(request)

        return ChatResponse(
            answer=answer,
            model=settings.openai_model,
        )

    except RuntimeError:
        raise HTTPException(
            status_code=500,
            detail="AI server configuration error",
        )

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="AI service request failed",
        )