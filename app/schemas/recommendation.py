from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    model_validator,
)


# =========================================================
# Common
# =========================================================


RecommendationSource = dict[str, str]


# =========================================================
# Exercise
# =========================================================


ExerciseTrainingType = Literal[
    "weight_training",
    "home_training",
    "bodyweight",
    "cardio",
    "stretching",
    "functional_training",
]


class ExerciseRecommendationRequest(BaseModel):
    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    goal_type: str | None = None

    experience_level: str | None = None

    available_minutes: int | None = Field(
        default=None,
        ge=5,
        le=300,
    )

    location: str | None = None

    preferred_training_types: list[
        ExerciseTrainingType
    ] = Field(
        default_factory=list
    )


class ExerciseItem(BaseModel):
    name: str

    duration_minutes: int | None = Field(
        default=None,
        ge=1,
        le=300,
    )

    intensity: str | None = None

    instructions: list[str] = Field(
        default_factory=list,
        max_length=3,
    )


class ExerciseSession(BaseModel):
    name: str

    focus: str | None = None

    estimated_duration_minutes: int | None = Field(
        default=None,
        ge=1,
        le=300,
    )

    exercises: list[ExerciseItem] = Field(
        default_factory=list,
        max_length=4,
    )


class ExerciseRecommendationResponse(BaseModel):
    summary: str

    weekly_frequency: int = Field(
        ge=1,
        le=7,
    )

    intensity: str

    sessions: list[ExerciseSession] = Field(
        default_factory=list
    )

    cautions: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    sources: list[RecommendationSource] = Field(
        default_factory=list
    )


# =========================================================
# Diet Request
# =========================================================


class DietRecommendationRequest(BaseModel):
    """
    Backend -> AI 식단 추천 입력.

    refrigerator_ingredients:
    - 냉장고 정보가 있으면 재료명 배열
    - 없으면 null 또는 []
    """

    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    food_allergens: list[str] = Field(
        default_factory=list
    )

    goal_type: str | None = None

    additional_input: (
        str
        | list[str]
        | None
    ) = None

    refrigerator_ingredients: (
        list[str]
        | None
    ) = None


# =========================================================
# Diet Meal
# =========================================================


DietDay = Literal[
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


DietMealType = Literal[
    "breakfast",
    "lunch",
    "dinner",
    "snack",
]


class MealNutrition(BaseModel):
    """
    메뉴 1인분 기준 예상 영양값.

    실제 임상 처방값이 아니라
    추천 메뉴의 예상값으로 사용한다.
    """

    carbohydrate_g: float = Field(
        ge=0,
        le=1000,
    )

    protein_g: float = Field(
        ge=0,
        le=1000,
    )

    fat_g: float = Field(
        ge=0,
        le=1000,
    )


class DietMeal(BaseModel):
    """
    추천 식사 한 끼.

    ingredients 의미:
    전체 조리 재료가 아니다.

    냉장고 데이터가 있는 경우:
    → 해당 메뉴에 실제 사용된 냉장고 재료만 반환

    냉장고 데이터가 없는 경우:
    → None
    """

    menu_name: str = Field(
        min_length=1,
        max_length=100,
    )

    menu_description: str = Field(
        default="",
        max_length=150,
    )

    estimated_calories_kcal: int = Field(
        ge=0,
        le=3000,
    )

    nutrition: MealNutrition

    ingredients: list[str] | None = None

    guidance: str = Field(
        default="",
        max_length=150,
    )


class DailyMeals(BaseModel):
    breakfast: DietMeal
    lunch: DietMeal
    dinner: DietMeal
    snack: DietMeal


class DietDayPlan(BaseModel):
    day: DietDay

    meals: DailyMeals


# =========================================================
# Diet Strategy
# =========================================================


class NutritionBalance(BaseModel):
    energy_strategy: str = ""
    carbohydrate_strategy: str = ""
    protein_strategy: str = ""
    fat_strategy: str = ""


class DietRecommendationResponse(BaseModel):
    summary: str

    strategy: str

    nutrition_balance: NutritionBalance

    weekly_plan: list[DietDayPlan] = Field(
        min_length=7,
        max_length=7,
    )

    dietary_principles: list[str] = Field(
        default_factory=list,
        max_length=6,
    )

    foods_to_prioritize: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    foods_to_limit: list[str] = Field(
        default_factory=list,
        max_length=8,
    )

    cautions: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    sources: list[RecommendationSource] = Field(
        default_factory=list
    )

    @model_validator(
        mode="after"
    )
    def validate_week(
        self,
    ):
        expected_days = {
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        }

        actual_days = [
            plan.day
            for plan in self.weekly_plan
        ]

        # 정확히 7개의 서로 다른 요일이어야 함
        if (
            len(actual_days) != 7
            or set(actual_days) != expected_days
        ):
            raise ValueError(
                "weekly_plan must contain "
                "monday through sunday exactly once."
            )

        return self


# =========================================================
# Replace Meal
# =========================================================


class ReplaceMealRequest(BaseModel):
    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    target_day: DietDay

    target_meal: DietMealType

    current_menu_name: str

    current_ingredients: list[str] = Field(
        default_factory=list
    )

    food_allergens: list[str] = Field(
        default_factory=list
    )

    goal_type: str | None = None

    additional_input: (
        str
        | list[str]
        | None
    ) = None

    refrigerator_ingredients: (
        list[str]
        | None
    ) = None


class ReplaceMealResponse(BaseModel):
    day: DietDay

    meal_type: DietMealType

    meal: DietMeal

    cautions: list[str] = Field(
        default_factory=list,
        max_length=5,
    )

    sources: list[RecommendationSource] = Field(
        default_factory=list
    )


# =========================================================
# Backend-compatible Wrapper
# =========================================================


class ExerciseGenerateResponse(BaseModel):
    """
    Backend 공개 API:

    POST /api/exercise/recommendations/generate

    {
        "ok": true,
        "generator": "...",
        "result": {...}
    }
    """

    ok: bool = True

    generator: str

    result: ExerciseRecommendationResponse


class DietGenerateResponse(BaseModel):
    """
    Backend 공개 API:

    POST /api/diet/recommendations/generate
    """

    ok: bool = True

    generator: str

    result: DietRecommendationResponse


class DietMealRegenerateResponse(BaseModel):
    """
    Backend 공개 API:

    POST /api/diet/meals/{diet_meal_id}/regenerate
    """

    ok: bool = True

    generator: str

    meal: ReplaceMealResponse