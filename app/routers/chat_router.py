import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
)

from app.core.security import (
    security,
    verify_api_key,
)

from app.schemas.chat import (
    ChatIntentResult,
    ChatRequest,
    ChatResponse,
)

from app.services.chat_intent_service import (
    classify_chat_intent,
)

from app.services.chat_orchestrator_service import (
    process_chat,
)


logger = logging.getLogger(
    __name__
)


router = APIRouter(
    tags=["chat"],
)


# =========================================================
# Production Chat API
# =========================================================


@router.post(
    "/chat/orchestrate",
    response_model=ChatResponse,
)
async def orchestrate_chat(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> ChatResponse:
    """
    Backend -> AI Server 운영용 챗봇 API.

    Backend가 DB에서 필요한 context를 구성하여 전달한다.
    AI Server는 DB에 직접 접근하지 않는다.
    """

    verify_api_key(
        credentials
    )

    try:
        return await process_chat(
            request
        )

    except Exception:
        # 사용자 질문, 건강정보, 식단정보 등은
        # 로그에 직접 출력하지 않는다.
        logger.exception(
            "Chat orchestration failed."
        )

        raise HTTPException(
            status_code=500,
            detail="Chat processing failed.",
        )


# =========================================================
# Development Intent Test
# =========================================================


@router.post(
    "/chat/intent-test",
    response_model=ChatIntentResult,
)
async def test_chat_intent(
    request: ChatRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> ChatIntentResult:
    """
    개발용 의도 분류 확인 API.
    """

    verify_api_key(
        credentials
    )

    try:
        return await classify_chat_intent(
            request.content
        )

    except Exception:
        logger.exception(
            "Chat intent classification failed."
        )

        raise HTTPException(
            status_code=500,
            detail="Chat intent classification failed.",
        )