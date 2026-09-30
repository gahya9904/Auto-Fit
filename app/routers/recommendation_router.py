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

from app.schemas.recommendation import (
    DietGenerateResponse,
    DietMealRegenerateResponse,
    DietRecommendationRequest,
    ExerciseGenerateResponse,
    ExerciseRecommendationRequest,
    ReplaceMealRequest,
)

from app.services.diet_recommendation_service import (
    generate_diet_recommendation,
    generate_replacement_meal,
)

from app.services.exercise_recommendation_service import (
    generate_exercise_recommendation,
)


logger = logging.getLogger(
    __name__
)


router = APIRouter(
    prefix="/recommend",
    tags=[
        "recommendation",
    ],
)


GENERATOR_NAME = (
    "auto-fit-ai"
)


# =========================================================
# Exercise Recommendation
# =========================================================


@router.post(
    "/exercise",
    response_model=ExerciseGenerateResponse,
)
async def recommend_exercise(
    request: ExerciseRecommendationRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> ExerciseGenerateResponse:
    """
    사용자 건강 상태 및 운동 선호 조건을 기반으로
    상세 운동 추천을 생성한다.
    """

    verify_api_key(
        credentials
    )

    try:
        result = (
            await generate_exercise_recommendation(
                request
            )
        )

        return ExerciseGenerateResponse(
            ok=True,
            generator=(
                GENERATOR_NAME
            ),
            result=result,
        )

    except RuntimeError:
        logger.exception(
            "Exercise recommendation "
            "service unavailable."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Exercise recommendation "
                "service is temporarily unavailable."
            ),
        )

    except Exception:
        logger.exception(
            "Exercise recommendation failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Exercise recommendation failed."
            ),
        )


# =========================================================
# Diet Recommendation
# =========================================================


@router.post(
    "/diet",
    response_model=DietGenerateResponse,
)
async def recommend_diet(
    request: DietRecommendationRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> DietGenerateResponse:
    """
    건강 상태, 사용자 목표, 알레르기,
    냉장고 재료를 기반으로 7일 식단을 생성한다.
    """

    verify_api_key(
        credentials
    )

    try:
        result = (
            await generate_diet_recommendation(
                request
            )
        )

        return DietGenerateResponse(
            ok=True,
            generator=(
                GENERATOR_NAME
            ),
            result=result,
        )

    except RuntimeError:
        logger.exception(
            "Diet recommendation "
            "service unavailable."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Diet recommendation service "
                "is temporarily unavailable."
            ),
        )

    except Exception:
        logger.exception(
            "Diet recommendation failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Diet recommendation failed."
            ),
        )


# =========================================================
# Replace Meal
# =========================================================


@router.post(
    "/diet/replace-meal",
    response_model=(
        DietMealRegenerateResponse
    ),
)
async def replace_diet_meal(
    request: ReplaceMealRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
) -> DietMealRegenerateResponse:
    """
    특정 요일/식사 슬롯의 메뉴 하나만
    새 메뉴로 교체한다.
    """

    verify_api_key(
        credentials
    )

    try:
        result = (
            await generate_replacement_meal(
                request
            )
        )

        return (
            DietMealRegenerateResponse(
                ok=True,
                generator=(
                    GENERATOR_NAME
                ),
                meal=result,
            )
        )

    except RuntimeError:
        logger.exception(
            "Diet meal replacement "
            "service unavailable."
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "Diet meal replacement service "
                "is temporarily unavailable."
            ),
        )

    except Exception:
        logger.exception(
            "Diet meal replacement failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Diet meal replacement failed."
            ),
        )