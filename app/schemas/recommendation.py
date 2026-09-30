from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    model_validator,
)


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
# Diet Types
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


# =========================================================
# Meal Nutrition
# =========================================================


class MealNutrition(BaseModel):
    carbohydrate_g: int = Field(
        ge=0,
        le=1000,
    )

    protein_g: int = Field(
        ge=0,
        le=1000,
    )

    fat_g: int = Field(
        ge=0,
        le=1000,
    )


# =========================================================
# Refrigerator Ingredient
# =========================================================


class DietIngredient(BaseModel):
    """
    실제 추천 메뉴에 사용된 냉장고 재료.

    전체 레시피 재료 목록이 아니다.
    모든 수치값은 정수.
    """

    name: str = Field(
        min_length=1,
        max_length=100,
    )

    recommended_amount: int = Field(
        ge=0,
        le=10000,
    )

    unit: str = Field(
        min_length=1,
        max_length=20,
    )

    carbohydrate_g: int = Field(
        ge=0,
        le=1000,
    )

    protein_g: int = Field(
        ge=0,
        le=1000,
    )

    fat_g: int = Field(
        ge=0,
        le=1000,
    )

    estimated_calories_kcal: int = Field(
        ge=0,
        le=5000,
    )


# =========================================================
# Diet Meal
# =========================================================


class DietMeal(BaseModel):
    menu_name: str = Field(
        min_length=1,
        max_length=100,
    )

    menu_description: str = Field(
        default="",
        max_length=150,
    )

    # -----------------------------------------------------
    # Stable Diffusion용 영문 이미지 프롬프트
    #
    # DB에 기존 이미지가 있는 메뉴라면 None 가능.
    # 신규 이미지 생성이 필요한 메뉴에서만 사용할 수 있다.
    # -----------------------------------------------------
    image_prompt: str | None = Field(
        default=None,
        max_length=700,
    )

    estimated_calories_kcal: int = Field(
        ge=0,
        le=3000,
    )

    nutrition: MealNutrition

    # 냉장고 재료가 없는 경우 None
    # 냉장고 재료가 있는 경우 실제 사용한 냉장고 재료만 포함
    ingredients: (
        list[DietIngredient]
        | None
    ) = None

    guidance: str = Field(
        default="",
        max_length=150,
    )


# =========================================================
# Daily Diet
# =========================================================


class DailyMeals(BaseModel):
    breakfast: DietMeal
    lunch: DietMeal
    dinner: DietMeal
    snack: DietMeal


class DietDayPlan(BaseModel):
    day: DietDay
    meals: DailyMeals


# =========================================================
# Nutrition Strategy
# =========================================================


class NutritionBalance(BaseModel):
    energy_strategy: str = ""
    carbohydrate_strategy: str = ""
    protein_strategy: str = ""
    fat_strategy: str = ""


# =========================================================
# Diet Response
# =========================================================


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
        """
        monday ~ sunday가
        정확히 한 번씩 존재하는지 검증한다.
        """

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
# Backend-compatible Response Wrapper
# =========================================================


class ExerciseGenerateResponse(BaseModel):
    ok: bool = True

    generator: str

    result: ExerciseRecommendationResponse


class DietGenerateResponse(BaseModel):
    ok: bool = True

    generator: str

    result: DietRecommendationResponse


class DietMealRegenerateResponse(BaseModel):
    ok: bool = True

    generator: str

    meal: ReplaceMealResponse