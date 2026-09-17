import secrets

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import get_settings


security = HTTPBearer(auto_error=False)


def verify_api_key(
    credentials: HTTPAuthorizationCredentials | None,
) -> None:

    settings = get_settings()

    if not settings.ai_server_api_key:
        raise HTTPException(
            status_code=500,
            detail="AI server authentication is not configured",
        )

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required",
        )

    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication scheme",
        )

    if not secrets.compare_digest(
        credentials.credentials,
        settings.ai_server_api_key,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )