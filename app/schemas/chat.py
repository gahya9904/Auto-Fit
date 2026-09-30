from typing import Any, Literal

from pydantic import (
    BaseModel,
    Field,
)


ChatIntent = Literal[
    "health_question",
    "exercise_question",
    "diet_question",
    "diet_replace_request",
    "general_chat",
]


ChatRole = Literal[
    "user",
    "assistant",
]


# =========================================================
# Internal Chat Models
# =========================================================


class ChatHistoryItem(BaseModel):
    role: ChatRole

    content: str = Field(
        min_length=1,
        max_length=500,
    )


class ChatContext(BaseModel):
    metric_statuses: dict[str, str] = Field(
        default_factory=dict
    )

    goal_type: str | None = None

    food_allergens: list[str] | None = None

    additional_input: str | list[str] | None = None

    refrigerator_ingredients: list[str] | None = None

    exercise_summary: dict | None = None

    diet_summary: dict | None = None


class ChatRequest(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=500,
    )

    history: list[ChatHistoryItem] = Field(
        default_factory=list,
        max_length=6,
    )

    context: ChatContext | None = None


class ChatIntentResult(BaseModel):
    intent: ChatIntent

    confidence: float = Field(
        ge=0.0,
        le=1.0,
    )

    target_day: str | None = None

    target_meal: str | None = None


class ChatResponse(BaseModel):
    intent: ChatIntent

    message: str

    action: str | None = None

    target_day: str | None = None

    target_meal: str | None = None

    data: dict | None = None


# =========================================================
# Backend Compatibility Models
# =========================================================


class BackendChatHistoryItem(BaseModel):
    role: str
    content: str


class BackendChatRequest(BaseModel):
    """
    기존 Backend -> AI Server /chat 계약.

    Backend 코드를 변경하지 않고
    AI Server에서 호환한다.
    """

    question: str = Field(
        min_length=1,
        max_length=8000,
    )

    user_info: dict[str, Any] = Field(
        default_factory=dict
    )

    chat_history: list[BackendChatHistoryItem] = Field(
        default_factory=list,
        max_length=20,
    )


class BackendChatResponse(BaseModel):
    """
    기존 Backend가 기대하는 응답 계약.
    """

    answer: str

    model: str