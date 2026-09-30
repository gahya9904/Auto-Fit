from typing import Literal

from pydantic import (
    BaseModel,
    Field,
    field_validator,
)


# =========================================================
# Common Types
# =========================================================


MealType = Literal[
    "breakfast",
    "lunch",
    "dinner",
    "snack",
]


ImageFormat = Literal[
    "png",
]


GenerationStatus = Literal[
    "completed",
    "failed",
]


GenerationErrorCode = Literal[
    "INVALID_INPUT",
    "UNSAFE_REQUEST",
    "GENERATION_FAILED",
    "TIMEOUT",
    "RATE_LIMITED",
    "INTERNAL_ERROR",
]


# =========================================================
# Request
# =========================================================


class FoodItem(BaseModel):
    """
    Backend에서 전달하는 개별 음식 정보.

    quantity는 이미지 생성 시 정확한 계량 표현보다는
    음식 간 상대적인 양을 결정하는 힌트로 사용한다.
    """

    food_name: str = Field(
        min_length=1,
        max_length=100,
    )

    quantity: float = Field(
        gt=0,
        le=10000,
    )

    unit: str = Field(
        min_length=1,
        max_length=20,
    )


class VisualSpec(BaseModel):
    """
    Backend에서 전달하는 음식 이미지 시각화 조건.
    """

    style: str = Field(
        min_length=1,
        max_length=100,
    )

    composition: str = Field(
        min_length=1,
        max_length=100,
    )

    camera_view: str = Field(
        min_length=1,
        max_length=100,
    )

    background: str = Field(
        min_length=1,
        max_length=100,
    )

    people: bool = False
    text: bool = False
    logo: bool = False

    width: int = Field(
        ge=256,
        le=2048,
    )

    height: int = Field(
        ge=256,
        le=2048,
    )

    format: ImageFormat = "png"

    @field_validator(
        "width",
        "height",
    )
    @classmethod
    def validate_image_size(
        cls,
        value: int,
    ) -> int:
        """
        Stable Diffusion 계열 모델 처리를 위해
        8의 배수인지 검증한다.
        """

        if value % 8 != 0:
            raise ValueError(
                "width and height must be multiples of 8"
            )

        return value


class MenuImageGenerateRequest(BaseModel):
    """
    Backend -> Food Image Server

    식단 한 끼당 이미지 1장을 생성한다.
    """

    schema_version: Literal["1.0"]

    request_id: str = Field(
        min_length=1,
        max_length=200,
    )

    image_key: str = Field(
        min_length=1,
        max_length=200,
    )

    menu_name: str = Field(
        min_length=1,
        max_length=300,
    )

    meal_type: MealType

    foods: list[FoodItem] = Field(
        min_length=1,
        max_length=20,
    )

    food_tags: list[str] = Field(
        default_factory=list,
        max_length=30,
    )

    visual_spec: VisualSpec


# =========================================================
# Success Response
# =========================================================


class GeneratedImagePayload(BaseModel):
    """
    Backend로 반환되는 이미지 데이터.

    base64에는:
    data:image/png;base64,...

    같은 Data URL prefix를 포함하지 않는다.
    """

    mime_type: Literal[
        "image/png"
    ] = "image/png"

    width: int

    height: int

    base64: str = Field(
        min_length=1
    )


class GenerationInfo(BaseModel):
    """
    실제 이미지 생성에 사용된 모델/프롬프트 정보.
    """

    model_name: str = Field(
        min_length=1,
        max_length=200,
    )

    model_version: str = Field(
        min_length=1,
        max_length=50,
    )

    seed: int = Field(
        ge=0,
    )

    prompt: str = Field(
        min_length=1,
        max_length=4000,
    )


class GenerationMetadata(BaseModel):
    generation_time_ms: int = Field(
        ge=0,
    )

    safety_checked: bool


class MenuImageGenerateSuccessResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"

    request_id: str

    image_key: str

    status: Literal[
        "completed"
    ] = "completed"

    image: GeneratedImagePayload

    generation: GenerationInfo

    metadata: GenerationMetadata


# =========================================================
# Failed Response
# =========================================================


class GenerationError(BaseModel):
    code: GenerationErrorCode

    message: str = Field(
        min_length=1,
        max_length=500,
    )

    retryable: bool


class MenuImageGenerateFailedResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"

    request_id: str

    image_key: str

    status: Literal[
        "failed"
    ] = "failed"

    error: GenerationError


# =========================================================
# Internal Label / Metadata
# =========================================================


class FoodImageLabel(BaseModel):
    """
    Backend 응답에는 포함하지 않는 내부 라벨링 데이터.

    생성 이미지 검증이나 향후 데이터셋 구축을 위해
    로컬에 저장할 수 있다.
    """

    image_key: str

    request_id: str

    menu_name: str

    meal_type: MealType

    foods: list[FoodItem]

    food_tags: list[str] = Field(
        default_factory=list
    )

    model_name: str

    model_version: str

    seed: int

    prompt: str

    generated_at: str

    verified: bool = False

    verified_label: str | None = None


# =========================================================
# FastAPI Response Type
# =========================================================


MenuImageGenerateResponse = (
    MenuImageGenerateSuccessResponse
    | MenuImageGenerateFailedResponse
)