from __future__ import annotations

import torch

from fastapi import (
    Depends,
    FastAPI,
    Request,
)

from fastapi.exceptions import (
    RequestValidationError,
)

from fastapi.responses import (
    JSONResponse,
)

from app.image_generator import (
    FoodImageGenerator,
)

from app.schemas import (
    GenerationError,
    MenuImageGenerateFailedResponse,
    MenuImageGenerateRequest,
)

from app.security import (
    verify_food_image_api_key,
)


# =========================================================
# FastAPI App
# =========================================================


app = FastAPI(
    title="Auto-Fit Food Image Server",
    version="1.0.0",
)


# =========================================================
# Generator Singleton
# =========================================================


generator: FoodImageGenerator | None = None


def get_generator() -> FoodImageGenerator:
    """
    Stable Diffusion 모델은 요청마다 다시 로드하지 않는다.

    최초 요청 시 한 번만 로드하고
    이후 동일 프로세스에서 계속 재사용한다.
    """

    global generator

    if generator is None:
        generator = FoodImageGenerator()

    return generator


# =========================================================
# Failure Response Helper
# =========================================================


def failed_response(
    *,
    request_id: str,
    image_key: str,
    code: str,
    message: str,
    retryable: bool,
    status_code: int,
) -> JSONResponse:
    """
    Backend 실패 응답 계약에 맞춘
    공통 JSONResponse 생성 함수.
    """

    response = MenuImageGenerateFailedResponse(
        schema_version="1.0",
        request_id=request_id,
        image_key=image_key,
        status="failed",
        error=GenerationError(
            code=code,
            message=message,
            retryable=retryable,
        ),
    )

    return JSONResponse(
        status_code=status_code,
        content=response.model_dump(),
    )


# =========================================================
# Validation Error Handler
# =========================================================


@app.exception_handler(
    RequestValidationError
)
async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    """
    FastAPI 기본 422 응답을
    Backend 계약의 INVALID_INPUT 형식으로 변환한다.
    """

    request_id = ""
    image_key = ""

    try:
        body = await request.json()

        if isinstance(
            body,
            dict,
        ):
            request_id = str(
                body.get(
                    "request_id",
                    "",
                )
            )

            image_key = str(
                body.get(
                    "image_key",
                    "",
                )
            )

    except Exception:
        pass

    details: list[str] = []

    for error in exc.errors():
        loc = ".".join(
            str(item)
            for item in error.get(
                "loc",
                []
            )
            if item != "body"
        )

        msg = error.get(
            "msg",
            "Invalid value",
        )

        if loc:
            details.append(
                f"{loc}: {msg}"
            )
        else:
            details.append(
                msg
            )

    message = (
        "; ".join(details)
        if details
        else "Invalid input"
    )

    response = MenuImageGenerateFailedResponse(
        schema_version="1.0",
        request_id=request_id,
        image_key=image_key,
        status="failed",
        error=GenerationError(
            code="INVALID_INPUT",
            message=message,
            retryable=False,
        ),
    )

    return JSONResponse(
        status_code=422,
        content=response.model_dump(),
    )


# =========================================================
# Root
# =========================================================


@app.get("/")
def root():
    """
    기본 루트 엔드포인트.

    브라우저에서 Base URL만 열어도
    서버가 정상 동작 중인지 확인할 수 있다.
    """

    return {
        "status": "ok",
        "service": "autofit-food-image-server",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }


# =========================================================
# Health Check
# =========================================================


@app.get(
    "/health"
)
def health():
    """
    서버 생존 확인용 endpoint.

    인증 없이 접근 가능.
    """

    return {
        "status": "ok",
        "service": "autofit-food-image-server",
        "version": "1.0.0",
    }


# =========================================================
# Generate Food Image
# =========================================================


@app.post(
    "/generate-food-image",
)
def generate_food_image(
    request: MenuImageGenerateRequest,

    _: None = Depends(
        verify_food_image_api_key
    ),
):
    """
    식단 한 끼당 음식 이미지 1장을 생성한다.

    인증:
    Authorization: Bearer <FOOD_IMAGE_API_KEY>

    동일 image_key:
    - 기존 cache 재사용

    신규 image_key:
    - Stable Diffusion 생성

    성공:
    - PNG Base64
    - seed
    - 최종 prompt
    - generation metadata 반환
    """

    try:

        # ---------------------------------------------
        # Safety Rules
        # ---------------------------------------------

        if request.visual_spec.people:
            return failed_response(
                request_id=(
                    request.request_id
                ),
                image_key=(
                    request.image_key
                ),
                code="UNSAFE_REQUEST",
                message=(
                    "Food images must not contain people."
                ),
                retryable=False,
                status_code=400,
            )

        if request.visual_spec.text:
            return failed_response(
                request_id=(
                    request.request_id
                ),
                image_key=(
                    request.image_key
                ),
                code="UNSAFE_REQUEST",
                message=(
                    "Food images must not contain text."
                ),
                retryable=False,
                status_code=400,
            )

        if request.visual_spec.logo:
            return failed_response(
                request_id=(
                    request.request_id
                ),
                image_key=(
                    request.image_key
                ),
                code="UNSAFE_REQUEST",
                message=(
                    "Food images must not contain logos."
                ),
                retryable=False,
                status_code=400,
            )

        # ---------------------------------------------
        # Generator
        # ---------------------------------------------

        image_generator = (
            get_generator()
        )

        # ---------------------------------------------
        # Generate / Cache Hit
        # ---------------------------------------------

        result = (
            image_generator.generate(
                request
            )
        )

        return result

    # =====================================================
    # CUDA OOM
    # =====================================================

    except torch.cuda.OutOfMemoryError:

        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        return failed_response(
            request_id=(
                request.request_id
            ),
            image_key=(
                request.image_key
            ),
            code="GENERATION_FAILED",
            message=(
                "GPU memory is insufficient for image generation."
            ),
            retryable=True,
            status_code=500,
        )

    # =====================================================
    # Timeout
    # =====================================================

    except TimeoutError:

        return failed_response(
            request_id=(
                request.request_id
            ),
            image_key=(
                request.image_key
            ),
            code="TIMEOUT",
            message=(
                "Image generation timed out."
            ),
            retryable=True,
            status_code=504,
        )

    # =====================================================
    # Unexpected Generation Failure
    # =====================================================

    except Exception as exc:

        print(
            "[ERROR]",
            type(exc).__name__,
            str(exc),
        )

        return failed_response(
            request_id=(
                request.request_id
            ),
            image_key=(
                request.image_key
            ),
            code="GENERATION_FAILED",
            message=(
                "Image generation failed"
            ),
            retryable=True,
            status_code=500,
        )