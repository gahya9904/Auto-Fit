import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from app.core.security import (
    verify_api_key,
)

from app.schemas.recommendation import (
    DietRecommendationRequest,
    DietRecommendationResponse,
    ExerciseRecommendationRequest,
    ExerciseRecommendationResponse,
    ReplaceMealRequest,
    ReplaceMealResponse,
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
    tags=["Recommendation"],
)


# =========================================================
# Exercise
# =========================================================


@router.post(
    "/exercise",
    response_model=ExerciseRecommendationResponse,
    dependencies=[
        Depends(
            verify_api_key
        )
    ],
)
async def recommend_exercise(
    request: ExerciseRecommendationRequest,
) -> ExerciseRecommendationResponse:

    try:
        return await generate_exercise_recommendation(
            request
        )

    except Exception:
        logger.exception(
            "Exercise recommendation generation failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "운동 추천을 생성하지 못했습니다."
            ),
        )


# =========================================================
# Weekly Diet
# =========================================================


@router.post(
    "/diet",
    response_model=DietRecommendationResponse,
    dependencies=[
        Depends(
            verify_api_key
        )
    ],
)
async def recommend_diet(
    request: DietRecommendationRequest,
) -> DietRecommendationResponse:

    try:
        return await generate_diet_recommendation(
            request
        )

    except Exception:
        logger.exception(
            "Diet recommendation generation failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "주간 식단 추천을 생성하지 못했습니다."
            ),
        )


# =========================================================
# Replace Single Meal
# =========================================================


@router.post(
    "/diet/replace-meal",
    response_model=ReplaceMealResponse,
    dependencies=[
        Depends(
            verify_api_key
        )
    ],
)
async def replace_diet_meal(
    request: ReplaceMealRequest,
) -> ReplaceMealResponse:

    try:
        return await generate_replacement_meal(
            request
        )

    except Exception:
        logger.exception(
            "Diet meal replacement generation failed."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "대체 식단을 생성하지 못했습니다."
            ),
        )