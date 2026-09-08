from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.security import security, verify_api_key
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm_service import llm_service


router = APIRouter(
    prefix="/chat",
    tags=["chat"],
)


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
        answer = await llm_service.generate(request)

        return ChatResponse(
            answer=answer,
            model=llm_service.model,
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