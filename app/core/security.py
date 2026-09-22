from fastapi import (
    Depends,
    HTTPException,
    status,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)

from app.core.config import get_settings


security = HTTPBearer(
    auto_error=False
)


def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> None:
    """
    Backend → AI Server 간 Bearer 인증 검증.

    Authorization:
        Bearer <AI_SERVER_API_KEY>
    """

    settings = get_settings()

    expected_key = settings.ai_server_api_key

    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI server authentication is not configured.",
        )

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization credentials.",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization scheme.",
        )

    if credentials.credentials != expected_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid AI server API key.",
        )


# 새 코드에서도 의미가 명확한 이름을 사용할 수 있도록 alias 제공
verify_ai_server_key = verify_api_key