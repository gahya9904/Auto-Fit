from __future__ import annotations

import os
import secrets

from dotenv import load_dotenv

from fastapi import (
    HTTPException,
    Security,
)

from fastapi.security import (
    HTTPAuthorizationCredentials,
    HTTPBearer,
)


load_dotenv()


bearer_scheme = HTTPBearer(
    auto_error=False,
    scheme_name="FoodImageBearer",
    description=(
        "Backend server-to-server API key"
    ),
)


def verify_food_image_api_key(
    credentials: (
        HTTPAuthorizationCredentials
        | None
    ) = Security(
        bearer_scheme
    ),
) -> None:

    expected_key = os.getenv(
        "FOOD_IMAGE_API_KEY"
    )

    if not expected_key:
        raise HTTPException(
            status_code=500,
            detail=(
                "FOOD_IMAGE_API_KEY is not configured"
            ),
        )

    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail=(
                "Authorization header is required"
            ),
        )

    if (
        credentials.scheme.lower()
        != "bearer"
    ):
        raise HTTPException(
            status_code=401,
            detail=(
                "Invalid authorization scheme"
            ),
        )

    if not secrets.compare_digest(
        credentials.credentials,
        expected_key,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key",
        )