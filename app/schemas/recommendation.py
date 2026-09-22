from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    model_validator,
)


# =========================================================
# Common
# =========================================================


class RecommendationSource(BaseModel):
    source_org: str
    title: str


# =========================================================
# Exercise
# =========================================================

TrainingType = Literal[
    "weight_training",
    "home_training",
    "bodyweight",
    "cardio",
    "stretching",
    "functional_training",
]


class ExerciseRecommendationRequest(BaseModel):
    """
    Backend -> AI Server 운동 추천 요청.

    metric_statuses에는 Rule Engine 상태값만 전달한다.
    원본 건강 수치와 개인정보는 전달하지 않는다.
    """

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

    preferred_training_types: list[TrainingType] = Field(
        default_factory=list
    )


class ExerciseItem(BaseModel):
    name: str

    duration_minutes: int = Field(
        ge=1
    )

    intensity: str

    instructions: list[str] = Field(
        default_factory=list
    )


class ExerciseSession(BaseModel):
    session_name: str

    exercises: list[ExerciseItem] = Field(
        default_factory=list
    )


class ExerciseRecommendationResponse(BaseModel):
    summary: str = ""

    weekly_frequency: int = Field(
        default=0,
        ge=0,
        le=7,
    )

    intensity: str = ""

    sessions: list[ExerciseSession] = Field(
        default_factory=list
    )

    cautions: list[str] = Field(
        default_factory=list
    )

    sources: list[RecommendationSource] = Field(
        default_factory=list
    )


# =========================================================
# Diet - Common Types
# =========================================================

DayType = Literal[
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]


MealType = Literal[
    "breakfast",
    "lunch",
    "dinner",
    "snack",
]


# =========================================================
# Diet - Weekly Request
# =========================================================


class DietRecommendationRequest(BaseModel):
    """
    Backend -> AI Server 주간 식단 추천 요청.

    최종 팀 API 기준:

    metric_statuses
        기존 건강 분석 상태값

    food_allergens
        기존 알레르기 데이터

    goal_type
        종합 분석의 goal.text 또는 Backend 변환값

    additional_input
        섭취 제한 / 선호 식단 / 싫어하는 음식 등을
        하나의 기타 입력으로 통합

    refrigerator_ingredients
        기존 냉장고 재료

    additional_input은 Backend 구조에 따라
    문자열 또는 문자열 배열 모두 허용한다.
    """

    # -----------------------------------------------------
    # 건강 상태
    # -----------------------------------------------------

    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    # -----------------------------------------------------
    # 최우선 안전 조건
    # -----------------------------------------------------

    food_allergens: list[str] | None = Field(
        default=None,
        max_length=20,
    )

    # -----------------------------------------------------
    # 사용자 목표
    # -----------------------------------------------------

    goal_type: str | None = Field(
        default=None,
        max_length=100,
    )

    # -----------------------------------------------------
    # 통합 기타 입력
    #
    # dietary_restrictions
    # preferred_diet_types
    # disliked_foods
    #
    # 를 모두 하나로 받는다.
    # -----------------------------------------------------

    additional_input: str | list[str] | None = None

    # -----------------------------------------------------
    # 냉장고 재료
    # -----------------------------------------------------

    refrigerator_ingredients: list[str] | None = Field(
        default=None,
        max_length=50,
    )


# =========================================================
# Diet - Nutrition Strategy
# =========================================================


class NutritionBalance(BaseModel):
    """
    정확한 의료 처방용 kcal/g 값이 아니라
    영양 구성 방향을 제공한다.
    """

    energy_strategy: str = Field(
        default="",
        max_length=150,
    )

    carbohydrate_strategy: str = Field(
        default="",
        max_length=150,
    )

    protein_strategy: str = Field(
        default="",
        max_length=150,
    )

    fat_strategy: str = Field(
        default="",
        max_length=150,
    )


# =========================================================
# Diet - Meal
# =========================================================


class MealRecommendation(BaseModel):
    """
    단순 재료 목록이 아니라 실제 완성 음식 형태로 반환한다.
    """

    menu_name: str = Field(
        min_length=1,
        max_length=100,
    )

    menu_description: str = Field(
        default="",
        max_length=120,
    )

    ingredients: list[str] = Field(
        default_factory=list,
        min_length=1,
        max_length=8,
    )

    guidance: str = Field(
        default="",
        max_length=80,
    )


class DailyMeals(BaseModel):
    """
    하루 구성은 반드시:

    아침
    점심
    저녁
    간식 1회
    """

    breakfast: MealRecommendation
    lunch: MealRecommendation
    dinner: MealRecommendation
    snack: MealRecommendation


class DailyDietPlan(BaseModel):
    day: DayType
    meals: DailyMeals


# =========================================================
# Diet - Weekly Response
# =========================================================


class DietRecommendationResponse(BaseModel):
    summary: str = Field(
        default="",
        max_length=500,
    )

    # Auto-Fit 종합 식단 전략
    strategy: str = Field(
        default="",
        max_length=500,
    )

    nutrition_balance: NutritionBalance

    # 정확히 7일
    weekly_plan: list[DailyDietPlan] = Field(
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

    @model_validator(mode="after")
    def validate_week(self):
        required_days = {
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        }

        actual_days = {
            item.day
            for item in self.weekly_plan
        }

        if actual_days != required_days:
            raise ValueError(
                "weekly_plan must contain Monday through Sunday exactly once."
            )

        return self


# =========================================================
# Diet - Replace Meal Request
# =========================================================


class ReplaceMealRequest(BaseModel):
    """
    기존 식단의 특정 요일 / 특정 식사 하나만 재추천한다.

    additional_input 역시 주간 식단과 동일하게
    하나의 기타 입력 필드만 사용한다.
    """

    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    target_day: DayType

    target_meal: MealType

    current_menu_name: str | None = Field(
        default=None,
        max_length=100,
    )

    current_ingredients: list[str] | None = Field(
        default=None,
        max_length=10,
    )

    food_allergens: list[str] | None = Field(
        default=None,
        max_length=20,
    )

    goal_type: str | None = Field(
        default=None,
        max_length=100,
    )

    additional_input: str | list[str] | None = None

    refrigerator_ingredients: list[str] | None = Field(
        default=None,
        max_length=50,
    )


class ReplaceMealResponse(BaseModel):
    day: DayType

    meal_type: MealType

    meal: MealRecommendation

    cautions: list[str] = Field(
        default_factory=list,
        max_length=4,
    )

    sources: list[RecommendationSource] = Field(
        default_factory=list
    )