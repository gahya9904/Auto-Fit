from __future__ import annotations

import os
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from math import ceil
from typing import Annotated, Any, Literal
from uuid import UUID

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.app.chat_health_scores import build_score_answer, fetch_scores
from backend.app.chat_answers import answer_question
from backend.app.chat_records import answer_records
from backend.app.chat_storage import ChatStore, fail as chat_fail
from backend.app.chat_rate_limit import ChatRateLimiter


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_publishable_key: str
    supabase_service_role_key: str
    frontend_origin: str


def get_settings() -> Settings:
    values = {
        "supabase_url": os.getenv("SUPABASE_URL", "").rstrip("/"),
        "supabase_publishable_key": os.getenv("SUPABASE_PUBLISHABLE_KEY", ""),
        "supabase_service_role_key": os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        "frontend_origin": os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
    }
    missing = [name.upper() for name, value in values.items() if not value]
    if missing:
        raise RuntimeError(f"Missing environment variables: {', '.join(missing)}")
    return Settings(**values)


class RoundtripRequest(BaseModel):
    message: str = Field(min_length=1, max_length=200)


class HealthScorePreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["latest", "change"] = "latest"
    explain: bool = False


class ChatAnswerPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    content: str = Field(min_length=1, max_length=500)

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class ChatMessageRequest(ChatAnswerPreviewRequest):
    client_message_id: UUID


class CreateChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("title", mode="before")
    @classmethod
    def trim_title(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class UpdateChatRequest(CreateChatRequest):
    status: Literal["active", "archived"] | None = None

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set or ("status" in self.model_fields_set and self.status is None):
            raise ValueError("Provide a title or valid status")
        return self


class ProfileUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=50)
    nickname: str | None = Field(default=None, max_length=30)
    birth_date: date | None = None
    gender: Literal["male", "female", "other"] | None = None
    target_weight: Decimal | None = Field(default=None, ge=20, le=500)
    activity_level: Literal[
        "sedentary", "light", "moderate", "active", "very_active"
    ] | None = None

    @field_validator("name", "nickname", mode="before")
    @classmethod
    def trim_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("birth_date")
    @classmethod
    def reject_future_birth_date(cls, value: date | None) -> date | None:
        if value and value > date.today():
            raise ValueError("birth_date cannot be in the future")
        return value

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "ProfileUpdateRequest":
        if not self.model_fields_set:
            raise ValueError("At least one profile field is required")
        return self


class AllergySelectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allergy_type_ids: list[UUID] = Field(default_factory=list, max_length=12)
    custom_names: list[str] = Field(default_factory=list, max_length=5)

    @field_validator("allergy_type_ids")
    @classmethod
    def deduplicate_type_ids(cls, values: list[UUID]) -> list[UUID]:
        return list(dict.fromkeys(values))

    @field_validator("custom_names")
    @classmethod
    def normalize_custom_names(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            name = value.strip()
            if not 1 <= len(name) <= 50:
                raise ValueError("Custom allergy names must be between 1 and 50 characters")
            key = name.casefold()
            if key not in seen:
                normalized.append(name)
                seen.add(key)
        return normalized


class CompleteOnboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExercisePreferencesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal_type: Literal[
        "weight_loss",
        "muscle_gain",
        "endurance",
        "maintenance",
        "rehabilitation",
    ]
    experience_level: Literal["beginner", "intermediate", "advanced"]


class ExerciseRecommendationContextRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    available_minutes: int = Field(ge=5, le=300)
    location: Literal["gym", "home", "outdoor", "other"]
    available_equipment: list[
        Literal["machine", "band", "dumbbell", "mat", "other"]
    ] = Field(default_factory=list, max_length=5)
    condition_level: str = Field(min_length=1, max_length=30)
    discomfort_areas: list[str] = Field(default_factory=list, max_length=10)
    condition_note: str | None = Field(default=None, max_length=500)

    @field_validator("available_equipment")
    @classmethod
    def deduplicate_equipment(cls, values: list[str]) -> list[str]:
        return list(dict.fromkeys(values))

    @field_validator("condition_level", mode="before")
    @classmethod
    def trim_condition_level(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("condition_note", mode="before")
    @classmethod
    def normalize_condition_note(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("discomfort_areas")
    @classmethod
    def normalize_discomfort_areas(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            area = value.strip()
            if not 1 <= len(area) <= 50:
                raise ValueError("Discomfort areas must be between 1 and 50 characters")
            key = area.casefold()
            if key not in seen:
                normalized.append(area)
                seen.add(key)
        return normalized


class GenerateExerciseRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class StartExerciseSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExerciseItemResultRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed: bool
    skipped: bool
    duration_minutes: int | None = Field(default=None, ge=0, le=300)
    completed_sets: int | None = Field(default=None, ge=0, le=100)
    performed_repetitions: int | None = Field(default=None, ge=0, le=10000)
    performed_weight_kg: Decimal | None = Field(default=None, ge=0, le=1000)
    note: str | None = Field(default=None, max_length=500)
    skip_reason: str | None = Field(default=None, max_length=200)

    @field_validator("note", "skip_reason", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_result_state(self) -> "ExerciseItemResultRequest":
        if self.completed == self.skipped:
            raise ValueError("Exactly one of completed or skipped must be true")
        if self.skipped and not self.skip_reason:
            raise ValueError("skip_reason is required when skipped is true")
        return self


class CompleteExerciseSessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExerciseDiscomfortRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exercise_item_id: UUID | None = None
    symptom_type: Literal["pain", "fatigue", "dizziness", "breathing", "other"]
    severity: int | None = Field(default=None, ge=0, le=10)
    body_areas: list[str] = Field(default_factory=list, max_length=10)
    detail: str | None = Field(default=None, max_length=500)
    action_taken: Literal["adjust", "stop", "continue"]

    @field_validator("body_areas")
    @classmethod
    def normalize_body_areas(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            area = value.strip()
            if not 1 <= len(area) <= 50:
                raise ValueError("Body areas must be between 1 and 50 characters")
            key = area.casefold()
            if key not in seen:
                normalized.append(area)
                seen.add(key)
        return normalized

    @field_validator("detail", mode="before")
    @classmethod
    def normalize_detail(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None


class ExerciseSessionFeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    perceived_difficulty: int = Field(ge=1, le=5)
    post_condition: Literal["very_bad", "bad", "normal", "good", "very_good"]
    uncomfortable_areas: list[str] = Field(default_factory=list, max_length=10)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("uncomfortable_areas")
    @classmethod
    def normalize_uncomfortable_areas(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for value in values:
            area = value.strip()
            if not 1 <= len(area) <= 50:
                raise ValueError("Uncomfortable areas must be between 1 and 50 characters")
            key = area.casefold()
            if key not in seen:
                normalized.append(area)
                seen.add(key)
        return normalized

    @field_validator("note", mode="before")
    @classmethod
    def normalize_feedback_note(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None


class ExerciseGoalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal_type: Literal[
        "weight_loss",
        "muscle_gain",
        "endurance",
        "maintenance",
        "rehabilitation",
    ]
    weekly_frequency: int = Field(ge=1, le=7)
    weekly_duration_minutes: int = Field(ge=1, le=10080)
    goal_period_weeks: int = Field(ge=1, le=260)
    starts_on: date = Field(default_factory=date.today)


class FoodInventoryCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    quantity: Decimal | None = Field(default=None, ge=0, le=100000)
    unit: str | None = Field(default=None, max_length=20)
    purchased_on: date | None = None
    expires_on: date | None = None

    @field_validator("name", "unit", mode="before")
    @classmethod
    def normalize_inventory_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_inventory_dates(self) -> "FoodInventoryCreateRequest":
        if self.purchased_on and self.expires_on and self.expires_on < self.purchased_on:
            raise ValueError("expires_on cannot be before purchased_on")
        return self


class GenerateDietRecommendationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")


class MealLogItemRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_name: str = Field(min_length=1, max_length=100)
    quantity: Decimal = Field(gt=0, le=100000)
    unit: str = Field(min_length=1, max_length=20)
    calories: Decimal | None = Field(default=None, ge=0, le=100000)
    carbohydrates: Decimal | None = Field(default=None, ge=0, le=10000)
    protein: Decimal | None = Field(default=None, ge=0, le=10000)
    fat: Decimal | None = Field(default=None, ge=0, le=10000)

    @field_validator("food_name", "unit", mode="before")
    @classmethod
    def normalize_meal_item_text(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class DietMealFeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    feedback_type: Literal["eaten", "different_food", "skipped"]
    eaten_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    actual_items: list[MealLogItemRequest] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def require_actual_items_for_changed_meal(self) -> "DietMealFeedbackRequest":
        if self.feedback_type == "different_food" and not self.actual_items:
            raise ValueError("actual_items are required for different_food")
        if self.feedback_type != "different_food" and self.actual_items:
            raise ValueError("actual_items are only allowed for different_food")
        return self


class AuthenticatedUser(BaseModel):
    id: str
    email: str | None = None


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token is required",
        )

    token = authorization.removeprefix("Bearer ").strip()
    headers = {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {token}",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/auth/v1/user",
            headers=headers,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Supabase session",
        )

    payload = response.json()
    return AuthenticatedUser(id=payload["id"], email=payload.get("email"))


def service_headers(settings: Settings, *, return_representation: bool = False) -> dict[str, str]:
    key = settings.supabase_service_role_key
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    if return_representation:
        headers["Prefer"] = "return=representation"
    return headers


async def fetch_profile(user_id: str, settings: Settings) -> dict[str, Any]:
    params = {
        "select": (
            "user_id,name,nickname,birth_date,gender,target_weight,"
            "activity_level,onboarding_completed_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "limit": "1",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/profiles",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase profile query failed",
        )

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile was not created for this user",
        )
    return rows[0]


async def update_profile(
    user_id: str,
    updates: dict[str, Any],
    settings: Settings,
) -> dict[str, Any]:
    params = {
        "select": (
            "user_id,name,nickname,birth_date,gender,target_weight,"
            "activity_level,onboarding_completed_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.patch(
            f"{settings.supabase_url}/rest/v1/profiles",
            headers=service_headers(settings, return_representation=True),
            params=params,
            json=updates,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase profile update failed",
        )

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile was not found for this user",
        )
    return rows[0]


async def fetch_allergy_catalog(settings: Settings) -> list[dict[str, Any]]:
    params = {
        "select": "allergy_type_id,name,description",
        "is_active": "eq.true",
        "order": "name.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/allergy_types",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase allergy catalog query failed",
        )
    return response.json()


async def fetch_user_allergies(
    user_id: str,
    settings: Settings,
) -> list[dict[str, Any]]:
    params = {
        "select": "user_allergy_id,allergy_type_id,custom_name,created_at",
        "user_id": f"eq.{user_id}",
        "order": "created_at.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/user_allergies",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase user allergy query failed",
        )
    return response.json()


async def replace_user_allergies(
    user_id: str,
    selection: AllergySelectionRequest,
    settings: Settings,
) -> list[dict[str, Any]]:
    payload = {
        "p_user_id": user_id,
        "p_allergy_type_ids": [str(value) for value in selection.allergy_type_ids],
        "p_custom_names": selection.custom_names,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/replace_user_allergies",
            headers=service_headers(settings),
            json=payload,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
            if response.status_code == status.HTTP_400_BAD_REQUEST
            else status.HTTP_502_BAD_GATEWAY,
            detail="Supabase allergy update failed",
        )
    return response.json()


async def fetch_exercise_preferences(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    params = {
        "select": (
            "user_exercise_profile_id,user_id,goal_type,experience_level,"
            "created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/user_exercise_profiles",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise preference query failed",
        )
    rows = response.json()
    return rows[0] if rows else None


async def upsert_exercise_preferences(
    user_id: str,
    preferences: ExercisePreferencesRequest,
    settings: Settings,
) -> dict[str, Any]:
    headers = service_headers(settings)
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    params = {
        "on_conflict": "user_id",
        "select": (
            "user_exercise_profile_id,user_id,goal_type,experience_level,"
            "created_at,updated_at"
        ),
    }
    payload = {"user_id": user_id, **preferences.model_dump()}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/user_exercise_profiles",
            headers=headers,
            params=params,
            json=payload,
        )

    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise preference update failed",
        )
    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise preference update returned no data",
        )
    return rows[0]


async def fetch_latest_exercise_context(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    params = {
        "select": (
            "exercise_recommendation_context_id,exercise_recommendation_id,user_id,"
            "available_minutes,location,available_equipment,condition_level,"
            "discomfort_areas,condition_note,created_at"
        ),
        "user_id": f"eq.{user_id}",
        "order": "created_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_recommendation_contexts",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise context query failed",
        )
    rows = response.json()
    return rows[0] if rows else None


async def create_exercise_context(
    user_id: str,
    context: ExerciseRecommendationContextRequest,
    settings: Settings,
) -> dict[str, Any]:
    params = {
        "select": (
            "exercise_recommendation_context_id,exercise_recommendation_id,user_id,"
            "available_minutes,location,available_equipment,condition_level,"
            "discomfort_areas,condition_note,created_at"
        ),
    }
    payload = {"user_id": user_id, **context.model_dump()}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/exercise_recommendation_contexts",
            headers=service_headers(settings, return_representation=True),
            params=params,
            json=payload,
        )

    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise context creation failed",
        )
    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise context creation returned no data",
        )
    return rows[0]


async def fetch_latest_unlinked_exercise_context(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    params = {
        "select": (
            "exercise_recommendation_context_id,exercise_recommendation_id,user_id,"
            "available_minutes,location,available_equipment,condition_level,"
            "discomfort_areas,condition_note,created_at"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_recommendation_id": "is.null",
        "order": "created_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_recommendation_contexts",
            headers=service_headers(settings),
            params=params,
        )

    if response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise context query failed",
        )
    rows = response.json()
    return rows[0] if rows else None


def build_exercise_recommendation_plan(
    preferences: dict[str, Any],
    context: dict[str, Any],
) -> dict[str, Any]:
    goal = preferences["goal_type"]
    experience = preferences["experience_level"]
    available_minutes = int(context["available_minutes"])
    equipment = set(context.get("available_equipment") or [])
    discomfort_areas = context.get("discomfort_areas") or []
    condition = str(context.get("condition_level") or "").casefold()

    risk_words = ("나쁨", "피곤", "통증", "어지", "bad", "tired", "pain", "dizzy")
    if discomfort_areas or any(word in condition for word in risk_words):
        intensity = "low"
    elif experience == "advanced":
        intensity = "high"
    else:
        intensity = "moderate"

    if goal == "muscle_gain":
        if equipment.intersection({"machine", "dumbbell"}):
            main_type, main_name = "웨이트 트레이닝", "전신 웨이트 트레이닝"
        else:
            main_type, main_name = "스쿼트", "맨몸 스쿼트"
        main_execution = "count_based"
        main_sets = 3 if intensity != "low" else 2
        main_repetitions = 12 if intensity != "low" else 8
    elif goal == "rehabilitation":
        main_type, main_name = "요가", "저강도 회복 요가"
        main_execution = "time_based"
        main_sets = main_repetitions = None
    elif goal == "endurance" and intensity != "low":
        main_type, main_name = "달리기", "가벼운 지속 달리기"
        main_execution = "time_based"
        main_sets = main_repetitions = None
    else:
        main_type, main_name = "걷기", "빠르게 걷기"
        main_execution = "time_based"
        main_sets = main_repetitions = None

    warmup_minutes = max(1, min(5, available_minutes // 6))
    cooldown_minutes = max(1, min(5, available_minutes // 6))
    main_minutes = max(1, available_minutes - warmup_minutes - cooldown_minutes)
    estimated_calories = max(1, round(available_minutes * (3 if intensity == "low" else 5)))

    items = [
        {
            "exercise_type_name": "스트레칭",
            "exercise_name": "전신 워밍업 스트레칭",
            "duration_minutes": warmup_minutes,
            "sets": None,
            "repetitions": None,
            "calories_burned": max(1, warmup_minutes * 2),
            "intensity": "low",
            "instruction": "통증이 없는 범위에서 천천히 관절과 근육을 풀어주세요.",
            "execution_type": "time_based",
            "target_duration_seconds": warmup_minutes * 60,
            "target_weight_kg": None,
            "rest_seconds": 30,
        },
        {
            "exercise_type_name": main_type,
            "exercise_name": main_name,
            "duration_minutes": main_minutes,
            "sets": main_sets,
            "repetitions": main_repetitions,
            "calories_burned": max(1, estimated_calories - warmup_minutes * 2 - cooldown_minutes * 2),
            "intensity": intensity,
            "instruction": "불편함이나 어지러움이 생기면 즉시 강도를 낮추거나 중단하세요.",
            "execution_type": main_execution,
            "target_duration_seconds": main_minutes * 60 if main_execution == "time_based" else None,
            "target_weight_kg": None,
            "rest_seconds": 60,
        },
        {
            "exercise_type_name": "스트레칭",
            "exercise_name": "마무리 스트레칭",
            "duration_minutes": cooldown_minutes,
            "sets": None,
            "repetitions": None,
            "calories_burned": max(1, cooldown_minutes * 2),
            "intensity": "low",
            "instruction": "호흡을 고르며 사용한 근육을 부드럽게 이완하세요.",
            "execution_type": "time_based",
            "target_duration_seconds": cooldown_minutes * 60,
            "target_weight_kg": None,
            "rest_seconds": 0,
        },
    ]

    goal_labels = {
        "weight_loss": "체지방 감량",
        "muscle_gain": "근력량 증가",
        "endurance": "체력 향상",
        "maintenance": "건강 유지",
        "rehabilitation": "컨디셔닝 / 기능 회복",
    }
    return {
        "recommendation": {
            "recommendation_date": date.today().isoformat(),
            "goal": goal,
            "total_duration_minutes": available_minutes,
            "intensity": intensity,
            "recommendation_summary": f"{goal_labels[goal]} 목표를 위한 {available_minutes}분 루틴",
            "ai_reason": (
                "운동 목표, 경험 수준, 사용 가능 시간과 장비, 현재 컨디션 및 "
                "불편 부위를 반영한 규칙 기반 테스트 추천입니다."
            ),
        },
        "items": items,
    }


async def create_exercise_recommendation(
    user_id: str,
    context_id: str,
    plan: dict[str, Any],
    settings: Settings,
) -> dict[str, Any]:
    payload = {
        "p_user_id": user_id,
        "p_context_id": context_id,
        "p_recommendation": plan["recommendation"],
        "p_items": plan["items"],
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/create_exercise_recommendation",
            headers=service_headers(settings),
            json=payload,
        )

    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise recommendation creation failed",
        )
    return response.json()


async def fetch_latest_exercise_recommendation(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    recommendation_params = {
        "select": (
            "exercise_recommendation_id,user_id,recommendation_date,goal,"
            "total_duration_minutes,intensity,recommendation_summary,ai_reason,"
            "status,created_at"
        ),
        "user_id": f"eq.{user_id}",
        "order": "recommendation_date.desc,created_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        recommendation_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_recommendations",
            headers=service_headers(settings),
            params=recommendation_params,
        )

    if recommendation_response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise recommendation query failed",
        )
    recommendations = recommendation_response.json()
    if not recommendations:
        return None

    recommendation = recommendations[0]
    item_params = {
        "select": (
            "exercise_item_id,exercise_recommendation_id,exercise_type_id,"
            "exercise_name,sequence_order,duration_minutes,sets,repetitions,"
            "calories_burned,intensity,instruction,execution_type,"
            "target_duration_seconds,target_weight_kg,rest_seconds"
        ),
        "exercise_recommendation_id": f"eq.{recommendation['exercise_recommendation_id']}",
        "order": "sequence_order.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        item_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_items",
            headers=service_headers(settings),
            params=item_params,
        )

    if item_response.status_code != status.HTTP_200_OK:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise item query failed",
        )
    return {"recommendation": recommendation, "items": item_response.json()}


async def call_exercise_session_rpc(
    name: str,
    payload: dict[str, Any],
    settings: Settings,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/{name}",
            headers=service_headers(settings),
            json=payload,
        )

    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Exercise session operation failed: {name}",
        )
    return response.json()


async def fetch_latest_exercise_session(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    session_params = {
        "select": (
            "exercise_session_id,user_id,exercise_recommendation_id,status,"
            "started_at,completed_at,planned_item_count,completed_item_count,"
            "skipped_item_count,total_duration_seconds,total_calories_burned,"
            "completion_rate,created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "order": "started_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        session_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_sessions",
            headers=service_headers(settings),
            params=session_params,
        )
    if not session_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise session query failed",
        )
    sessions = session_response.json()
    if not sessions:
        return None

    session = sessions[0]
    log_params = {
        "select": (
            "exercise_log_id,exercise_session_id,exercise_item_id,exercise_name,"
            "performed_at,duration_minutes,calories_burned,intensity,completed,"
            "completed_sets,performed_repetitions,performed_weight_kg,skipped,"
            "skip_reason,note"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_session_id": f"eq.{session['exercise_session_id']}",
        "order": "performed_at.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        log_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_logs",
            headers=service_headers(settings),
            params=log_params,
        )
    if not log_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise log query failed",
        )
    return {"session": session, "logs": log_response.json()}


async def fetch_exercise_discomfort_logs(
    user_id: str,
    session_id: str,
    settings: Settings,
) -> list[dict[str, Any]]:
    params = {
        "select": (
            "exercise_discomfort_log_id,exercise_session_id,exercise_item_id,"
            "user_id,symptom_type,severity,body_areas,detail,action_taken,"
            "occurred_at,created_at"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_session_id": f"eq.{session_id}",
        "order": "occurred_at.desc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_discomfort_logs",
            headers=service_headers(settings),
            params=params,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise discomfort query failed",
        )
    return response.json()


async def save_exercise_session_feedback(
    user_id: str,
    session_id: str,
    body: ExerciseSessionFeedbackRequest,
    settings: Settings,
) -> dict[str, Any]:
    return await call_exercise_session_rpc(
        "save_exercise_session_feedback",
        {
            "p_user_id": user_id,
            "p_session_id": session_id,
            "p_perceived_difficulty": body.perceived_difficulty,
            "p_post_condition": body.post_condition,
            "p_uncomfortable_areas": body.uncomfortable_areas,
            "p_note": body.note,
        },
        settings,
    )


async def fetch_exercise_session_feedback(
    user_id: str,
    session_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    params = {
        "select": (
            "exercise_session_feedback_id,exercise_session_id,user_id,"
            "perceived_difficulty,post_condition,uncomfortable_areas,note,"
            "created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_session_id": f"eq.{session_id}",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_session_feedback",
            headers=service_headers(settings),
            params=params,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise session feedback query failed",
        )
    rows = response.json()
    return rows[0] if rows else None


async def fetch_exercise_session_result(
    user_id: str,
    session_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    session_params = {
        "select": (
            "exercise_session_id,user_id,exercise_recommendation_id,status,"
            "started_at,completed_at,planned_item_count,completed_item_count,"
            "skipped_item_count,total_duration_seconds,total_calories_burned,"
            "completion_rate,created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_session_id": f"eq.{session_id}",
        "limit": "1",
    }
    log_params = {
        "select": (
            "exercise_log_id,exercise_session_id,exercise_item_id,exercise_name,"
            "performed_at,duration_minutes,calories_burned,intensity,completed,"
            "completed_sets,performed_repetitions,performed_weight_kg,skipped,"
            "skip_reason,note"
        ),
        "user_id": f"eq.{user_id}",
        "exercise_session_id": f"eq.{session_id}",
        "order": "performed_at.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        session_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_sessions",
            headers=service_headers(settings),
            params=session_params,
        )
        if not session_response.is_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Supabase exercise session query failed",
            )
        sessions = session_response.json()
        if not sessions:
            return None
        log_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_logs",
            headers=service_headers(settings),
            params=log_params,
        )
    if not log_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise log query failed",
        )
    feedback = await fetch_exercise_session_feedback(user_id, session_id, settings)
    return {
        "session": sessions[0],
        "logs": log_response.json(),
        "feedback": feedback,
    }


async def fetch_active_exercise_goal(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    params = {
        "select": (
            "exercise_goal_id,user_id,goal_type,weekly_frequency,"
            "weekly_duration_minutes,goal_period_weeks,starts_on,ends_on,"
            "status,created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "status": "eq.active",
        "order": "starts_on.desc,updated_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_goals",
            headers=service_headers(settings),
            params=params,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise goal query failed",
        )
    rows = response.json()
    return rows[0] if rows else None


async def save_active_exercise_goal(
    user_id: str,
    body: ExerciseGoalRequest,
    settings: Settings,
) -> dict[str, Any]:
    payload = {
        "p_user_id": user_id,
        **{f"p_{key}": value for key, value in body.model_dump(mode="json").items()},
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/save_exercise_goal",
            headers=service_headers(settings),
            json=payload,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=(
                status.HTTP_422_UNPROCESSABLE_ENTITY
                if response.status_code == status.HTTP_400_BAD_REQUEST
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail="Supabase exercise goal update failed",
        )
    return response.json()


async def fetch_exercise_history(
    user_id: str,
    from_date: date,
    to_date: date,
    settings: Settings,
) -> list[dict[str, Any]]:
    start = f"{from_date.isoformat()}T00:00:00+00:00"
    end = f"{(to_date + timedelta(days=1)).isoformat()}T00:00:00+00:00"
    session_params = {
        "select": (
            "exercise_session_id,user_id,exercise_recommendation_id,status,"
            "started_at,completed_at,planned_item_count,completed_item_count,"
            "skipped_item_count,total_duration_seconds,total_calories_burned,"
            "completion_rate"
        ),
        "user_id": f"eq.{user_id}",
        "status": "in.(completed,stopped)",
        "started_at": f"gte.{start}",
        "and": f"(started_at.lt.{end})",
        "order": "started_at.desc",
    }
    log_params = {
        "select": (
            "exercise_log_id,exercise_session_id,exercise_item_id,exercise_name,"
            "performed_at,duration_minutes,calories_burned,intensity,completed,"
            "completed_sets,performed_repetitions,performed_weight_kg,skipped,"
            "skip_reason,note"
        ),
        "user_id": f"eq.{user_id}",
        "performed_at": f"gte.{start}",
        "and": f"(performed_at.lt.{end})",
        "order": "performed_at.asc",
    }
    feedback_params = {
        "select": (
            "exercise_session_feedback_id,exercise_session_id,"
            "perceived_difficulty,post_condition,uncomfortable_areas,note"
        ),
        "user_id": f"eq.{user_id}",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        session_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_sessions",
            headers=service_headers(settings),
            params=session_params,
        )
        log_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_logs",
            headers=service_headers(settings),
            params=log_params,
        )
        feedback_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_session_feedback",
            headers=service_headers(settings),
            params=feedback_params,
        )
    if not all(
        response.is_success
        for response in (session_response, log_response, feedback_response)
    ):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise history query failed",
        )

    sessions = session_response.json()
    session_ids = {row["exercise_session_id"] for row in sessions}
    logs_by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in log_response.json():
        if row["exercise_session_id"] in session_ids:
            logs_by_session[row["exercise_session_id"]].append(row)
    feedback_by_session = {
        row["exercise_session_id"]: row
        for row in feedback_response.json()
        if row["exercise_session_id"] in session_ids
    }
    return [
        {
            "session": session,
            "logs": logs_by_session[session["exercise_session_id"]],
            "feedback": feedback_by_session.get(session["exercise_session_id"]),
        }
        for session in sessions
    ]


async def fetch_exercise_category_map(
    history: list[dict[str, Any]],
    settings: Settings,
) -> dict[str, str]:
    item_ids = sorted(
        {
            log["exercise_item_id"]
            for entry in history
            for log in entry["logs"]
            if log.get("exercise_item_id")
        }
    )
    if not item_ids:
        return {}
    async with httpx.AsyncClient(timeout=10) as client:
        item_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_items",
            headers=service_headers(settings),
            params={
                "select": "exercise_item_id,exercise_type_id",
                "exercise_item_id": f"in.({','.join(item_ids)})",
            },
        )
        type_response = await client.get(
            f"{settings.supabase_url}/rest/v1/exercise_types",
            headers=service_headers(settings),
            params={
                "select": "exercise_type_id,category",
                "is_active": "eq.true",
            },
        )
    if not item_response.is_success or not type_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase exercise category query failed",
        )
    category_by_type = {
        row["exercise_type_id"]: row.get("category") or "기타"
        for row in type_response.json()
    }
    return {
        row["exercise_item_id"]: category_by_type.get(row["exercise_type_id"], "기타")
        for row in item_response.json()
    }


def build_exercise_progress(
    goal: dict[str, Any] | None,
    history: list[dict[str, Any]],
    category_by_item: dict[str, str],
    from_date: date,
    to_date: date,
) -> dict[str, Any]:
    workout_count = len(history)
    exercise_count = sum(
        int(entry["session"].get("completed_item_count") or 0) for entry in history
    )
    duration_minutes = round(
        sum(float(entry["session"].get("total_duration_seconds") or 0) for entry in history)
        / 60,
        1,
    )
    calories_burned = round(
        sum(float(entry["session"].get("total_calories_burned") or 0) for entry in history),
        1,
    )

    covered_weeks = ceil(((to_date - from_date).days + 1) / 7)
    target_workouts = (
        int(goal["weekly_frequency"]) * covered_weeks if goal else None
    )
    target_duration_minutes = (
        int(goal["weekly_duration_minutes"]) * covered_weeks if goal else None
    )
    if target_workouts and target_duration_minutes:
        workout_rate = min(workout_count / target_workouts, 1)
        duration_rate = min(duration_minutes / target_duration_minutes, 1)
        achievement_rate = round((workout_rate + duration_rate) * 50, 1)
    else:
        achievement_rate = None

    weekly: dict[date, dict[str, Any]] = {}
    workout_dates: set[date] = set()
    category_minutes: dict[str, float] = defaultdict(float)
    for entry in history:
        session = entry["session"]
        started_on = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00")).date()
        workout_dates.add(started_on)
        week_start = started_on - timedelta(days=started_on.weekday())
        bucket = weekly.setdefault(
            week_start,
            {"week_start": week_start.isoformat(), "workout_count": 0, "duration_minutes": 0.0, "calories_burned": 0.0},
        )
        bucket["workout_count"] += 1
        bucket["duration_minutes"] += float(session.get("total_duration_seconds") or 0) / 60
        bucket["calories_burned"] += float(session.get("total_calories_burned") or 0)
        for log in entry["logs"]:
            if log.get("completed"):
                category = category_by_item.get(log.get("exercise_item_id"), "기타")
                category_minutes[category] += float(log.get("duration_minutes") or 0)

    weekly_trend = []
    for key in sorted(weekly):
        bucket = weekly[key]
        bucket["duration_minutes"] = round(bucket["duration_minutes"], 1)
        bucket["calories_burned"] = round(bucket["calories_burned"], 1)
        weekly_trend.append(bucket)

    total_category_minutes = sum(category_minutes.values())
    category_distribution = [
        {
            "category": category,
            "duration_minutes": round(minutes, 1),
            "percentage": round(minutes / total_category_minutes * 100, 1),
        }
        for category, minutes in sorted(
            category_minutes.items(), key=lambda item: (-item[1], item[0])
        )
        if minutes > 0
    ]

    longest_streak = 0
    current_run = 0
    previous: date | None = None
    for workout_date in sorted(workout_dates):
        current_run = current_run + 1 if previous and workout_date == previous + timedelta(days=1) else 1
        longest_streak = max(longest_streak, current_run)
        previous = workout_date

    return {
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "goal": goal,
        "summary": {
            "workout_count": workout_count,
            "exercise_count": exercise_count,
            "duration_minutes": duration_minutes,
            "calories_burned": calories_burned,
            "target_workout_count": target_workouts,
            "target_duration_minutes": target_duration_minutes,
            "goal_achievement_rate": achievement_rate,
        },
        "weekly_trend": weekly_trend,
        "category_distribution": category_distribution,
        "achievements": {
            "active_days": len(workout_dates),
            "longest_workout_streak_days": longest_streak,
        },
    }


def exercise_progress_range(period: str, today: date | None = None) -> tuple[date, date]:
    end = today or date.today()
    if period == "week":
        start = end - timedelta(days=end.weekday())
    elif period == "month":
        start = end.replace(day=1)
    else:
        month_index = end.year * 12 + end.month - 3
        start = date(month_index // 12, month_index % 12 + 1, 1)
    return start, end


async def fetch_food_inventory(
    user_id: str,
    settings: Settings,
) -> list[dict[str, Any]]:
    params = {
        "select": (
            "user_food_inventory_id,user_id,food_item_id,custom_name,quantity,"
            "unit,purchased_on,expires_on,freshness_status,is_available,"
            "created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "is_available": "eq.true",
        "order": "expires_on.asc.nullslast,created_at.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/user_food_inventory",
            headers=service_headers(settings),
            params=params,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase food inventory query failed",
        )
    return response.json()


async def create_food_inventory_item(
    user_id: str,
    body: FoodInventoryCreateRequest,
    settings: Settings,
) -> dict[str, Any]:
    freshness = "unknown"
    if body.expires_on:
        remaining_days = (body.expires_on - date.today()).days
        freshness = (
            "expired"
            if remaining_days < 0
            else "expiring_soon"
            if remaining_days <= 3
            else "fresh"
        )
    payload = {
        "user_id": user_id,
        "custom_name": body.name,
        "quantity": str(body.quantity) if body.quantity is not None else None,
        "unit": body.unit,
        "purchased_on": body.purchased_on.isoformat() if body.purchased_on else None,
        "expires_on": body.expires_on.isoformat() if body.expires_on else None,
        "freshness_status": freshness,
        "is_available": True,
    }
    params = {
        "select": (
            "user_food_inventory_id,user_id,food_item_id,custom_name,quantity,"
            "unit,purchased_on,expires_on,freshness_status,is_available,"
            "created_at,updated_at"
        )
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/user_food_inventory",
            headers=service_headers(settings, return_representation=True),
            params=params,
            json=payload,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase food inventory creation failed",
        )
    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase food inventory creation returned no data",
        )
    return rows[0]


def build_diet_recommendation_plan(
    inventory: list[dict[str, Any]],
    allergy_names: list[str] | None = None,
) -> dict[str, Any]:
    inventory_names = [
        row["custom_name"] for row in inventory if row.get("custom_name")
    ]
    reflected = ", ".join(inventory_names[:3]) or "등록된 냉장고 재료 없음"
    normalized_allergies = {
        name.strip().casefold() for name in (allergy_names or []) if name.strip()
    }

    allergy_aliases = {
        "우유": {"그릭요거트"},
        "유제품": {"그릭요거트"},
        "milk": {"그릭요거트"},
        "dairy": {"그릭요거트"},
        "대두": {"두부구이"},
        "콩": {"두부구이"},
        "soy": {"두부구이"},
        "견과류": {"호두"},
        "견과": {"호두"},
        "호두": {"호두"},
        "nut": {"호두"},
        "생선": {"연어구이"},
        "어류": {"연어구이"},
        "fish": {"연어구이"},
        "닭": {"닭가슴살"},
        "chicken": {"닭가슴살"},
    }

    def conflicts(food_name: str) -> bool:
        normalized_food = food_name.casefold()
        for allergy in normalized_allergies:
            if allergy in normalized_food or normalized_food in allergy:
                return True
            if normalized_food in allergy_aliases.get(allergy, set()):
                return True
        return False

    safe_replacements = [
        {"food_name": "고구마", "quantity": 115, "unit": "g", "calories": 150, "carbohydrates": 36, "protein": 2, "fat": 0},
        {"food_name": "브로콜리", "quantity": 150, "unit": "g", "calories": 53, "carbohydrates": 11, "protein": 5, "fat": 1},
        {"food_name": "현미밥", "quantity": 100, "unit": "g", "calories": 147, "carbohydrates": 31, "protein": 3, "fat": 1},
        {"food_name": "블루베리", "quantity": 100, "unit": "g", "calories": 60, "carbohydrates": 14, "protein": 1, "fat": 0},
    ]

    meals = [
        {
            "meal_type": "breakfast",
            "meal_order": 1,
            "recommended_calories": 400,
            "recommendation_note": f"균형 잡힌 아침 식사 · 냉장고 반영: {reflected}",
            "foods": [
                {"food_name": "현미밥", "quantity": 150, "unit": "g", "calories": 220, "carbohydrates": 46, "protein": 4, "fat": 2},
                {"food_name": "닭가슴살", "quantity": 90, "unit": "g", "calories": 145, "carbohydrates": 0, "protein": 28, "fat": 3},
                {"food_name": "브로콜리", "quantity": 100, "unit": "g", "calories": 35, "carbohydrates": 7, "protein": 3, "fat": 0},
            ],
        },
        {
            "meal_type": "lunch",
            "meal_order": 2,
            "recommended_calories": 480,
            "recommendation_note": "단백질과 채소를 충분히 구성한 점심 식사",
            "foods": [
                {"food_name": "현미밥", "quantity": 180, "unit": "g", "calories": 264, "carbohydrates": 55, "protein": 5, "fat": 2},
                {"food_name": "두부구이", "quantity": 180, "unit": "g", "calories": 150, "carbohydrates": 5, "protein": 16, "fat": 8},
                {"food_name": "시금치무침", "quantity": 100, "unit": "g", "calories": 66, "carbohydrates": 7, "protein": 4, "fat": 3},
            ],
        },
        {
            "meal_type": "dinner",
            "meal_order": 3,
            "recommended_calories": 480,
            "recommendation_note": "지방은 낮추고 포만감을 유지하는 저녁 식사",
            "foods": [
                {"food_name": "고구마", "quantity": 200, "unit": "g", "calories": 260, "carbohydrates": 62, "protein": 3, "fat": 0},
                {"food_name": "연어구이", "quantity": 100, "unit": "g", "calories": 190, "carbohydrates": 0, "protein": 22, "fat": 11},
                {"food_name": "채소샐러드", "quantity": 120, "unit": "g", "calories": 30, "carbohydrates": 6, "protein": 2, "fat": 0},
            ],
        },
        {
            "meal_type": "snack",
            "meal_order": 4,
            "recommended_calories": 290,
            "recommendation_note": "과식을 막기 위한 단백질 간식",
            "foods": [
                {"food_name": "그릭요거트", "quantity": 150, "unit": "g", "calories": 150, "carbohydrates": 10, "protein": 15, "fat": 5},
                {"food_name": "블루베리", "quantity": 100, "unit": "g", "calories": 60, "carbohydrates": 14, "protein": 1, "fat": 0},
                {"food_name": "호두", "quantity": 12, "unit": "g", "calories": 80, "carbohydrates": 2, "protein": 2, "fat": 8},
            ],
        },
    ]
    excluded_foods: list[str] = []
    for meal in meals:
        safe_foods: list[dict[str, Any]] = []
        for food in meal["foods"]:
            if not conflicts(food["food_name"]):
                safe_foods.append(food)
                continue
            excluded_foods.append(food["food_name"])
            replacement = next(
                (
                    candidate
                    for candidate in safe_replacements
                    if not conflicts(candidate["food_name"])
                ),
                None,
            )
            if replacement is None:
                raise ValueError("No allergy-safe replacement food is available")
            safe_foods.append(replacement.copy())
        meal["foods"] = safe_foods
        meal["recommended_calories"] = sum(
            int(food["calories"]) for food in safe_foods
        )

    allergy_note = (
        f" 알레르기 제외 식재료: {', '.join(dict.fromkeys(excluded_foods))}."
        if excluded_foods
        else ""
    )
    return {
        "recommendation": {
            "recommendation_date": date.today().isoformat(),
            "target_calories": 1650,
            "target_carbohydrates": 210,
            "target_protein": 85,
            "target_fat": 45,
            "recommendation_summary": "체지방 감량 목표를 위한 균형 식단",
            "ai_reason": (
                "운동 목표, 사용 가능한 냉장고 재료와 알레르기 정보를 반영한 "
                f"규칙 기반 테스트 식단입니다.{allergy_note}"
            ),
        },
        "meals": meals,
    }


async def create_diet_recommendation(
    user_id: str,
    plan: dict[str, Any],
    settings: Settings,
) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/create_diet_recommendation",
            headers=service_headers(settings),
            json={
                "p_user_id": user_id,
                "p_recommendation": plan["recommendation"],
                "p_meals": plan["meals"],
            },
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase diet recommendation creation failed",
        )
    return response.json()


async def fetch_latest_diet_recommendation(
    user_id: str,
    settings: Settings,
) -> dict[str, Any] | None:
    recommendation_params = {
        "select": (
            "diet_recommendation_id,user_id,recommendation_date,target_calories,"
            "target_carbohydrates,target_protein,target_fat,"
            "recommendation_summary,ai_reason,status,created_at"
        ),
        "user_id": f"eq.{user_id}",
        "status": "eq.active",
        "order": "recommendation_date.desc,created_at.desc",
        "limit": "1",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        recommendation_response = await client.get(
            f"{settings.supabase_url}/rest/v1/diet_recommendations",
            headers=service_headers(settings),
            params=recommendation_params,
        )
    if not recommendation_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase diet recommendation query failed",
        )
    recommendations = recommendation_response.json()
    if not recommendations:
        return None
    recommendation = recommendations[0]
    meal_params = {
        "select": (
            "diet_meal_id,diet_recommendation_id,meal_type,meal_order,"
            "recommended_calories,recommendation_note,status,created_at"
        ),
        "diet_recommendation_id": f"eq.{recommendation['diet_recommendation_id']}",
        "order": "meal_order.asc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        meal_response = await client.get(
            f"{settings.supabase_url}/rest/v1/diet_meals",
            headers=service_headers(settings),
            params=meal_params,
        )
    if not meal_response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase diet meal query failed",
        )
    meals = meal_response.json()
    meal_ids = [row["diet_meal_id"] for row in meals]
    foods_by_meal: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if meal_ids:
        async with httpx.AsyncClient(timeout=10) as client:
            food_response = await client.get(
                f"{settings.supabase_url}/rest/v1/diet_meal_foods",
                headers=service_headers(settings),
                params={
                    "select": (
                        "diet_meal_food_id,diet_meal_id,food_item_id,food_name,"
                        "quantity,unit,calories,carbohydrates,protein,fat"
                    ),
                    "diet_meal_id": f"in.({','.join(meal_ids)})",
                    "order": "created_at.asc",
                },
            )
        if not food_response.is_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Supabase diet meal food query failed",
            )
        for food in food_response.json():
            foods_by_meal[food["diet_meal_id"]].append(food)
    return {
        "recommendation": recommendation,
        "meals": [
            {**meal, "foods": foods_by_meal[meal["diet_meal_id"]]}
            for meal in meals
        ],
    }


async def record_recommended_meal(
    user_id: str,
    diet_meal_id: str,
    body: DietMealFeedbackRequest,
    settings: Settings,
) -> dict[str, Any]:
    payload = {
        "p_user_id": user_id,
        "p_diet_meal_id": diet_meal_id,
        "p_feedback_type": body.feedback_type,
        "p_eaten_at": body.eaten_at.isoformat(),
        "p_actual_items": [
            item.model_dump(mode="json") for item in body.actual_items
        ],
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"{settings.supabase_url}/rest/v1/rpc/record_recommended_meal",
            headers=service_headers(settings),
            json=payload,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=(
                status.HTTP_409_CONFLICT
                if response.status_code == status.HTTP_400_BAD_REQUEST
                else status.HTTP_502_BAD_GATEWAY
            ),
            detail="Supabase recommended meal recording failed",
        )
    return response.json()


async def fetch_meal_logs(
    user_id: str,
    from_date: date,
    to_date: date,
    settings: Settings,
) -> list[dict[str, Any]]:
    start = f"{from_date.isoformat()}T00:00:00+00:00"
    end = f"{(to_date + timedelta(days=1)).isoformat()}T00:00:00+00:00"
    params = {
        "select": (
            "meal_log_id,user_id,diet_meal_id,meal_type,source_type,eaten_at,"
            "status,note,created_at,updated_at"
        ),
        "user_id": f"eq.{user_id}",
        "status": "eq.recorded",
        "eaten_at": f"gte.{start}",
        "and": f"(eaten_at.lt.{end})",
        "order": "eaten_at.desc",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(
            f"{settings.supabase_url}/rest/v1/meal_logs",
            headers=service_headers(settings),
            params=params,
        )
    if not response.is_success:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase meal log query failed",
        )
    logs = response.json()
    log_ids = [row["meal_log_id"] for row in logs]
    items_by_log: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if log_ids:
        async with httpx.AsyncClient(timeout=10) as client:
            item_response = await client.get(
                f"{settings.supabase_url}/rest/v1/meal_log_items",
                headers=service_headers(settings),
                params={
                    "select": (
                        "meal_log_item_id,meal_log_id,food_item_id,food_name,"
                        "brand_name,quantity,unit,calories,carbohydrates,protein,"
                        "fat,sequence_order"
                    ),
                    "meal_log_id": f"in.({','.join(log_ids)})",
                    "order": "sequence_order.asc",
                },
            )
        if not item_response.is_success:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Supabase meal log item query failed",
            )
        for item in item_response.json():
            items_by_log[item["meal_log_id"]].append(item)
    return [{**log, "items": items_by_log[log["meal_log_id"]]} for log in logs]


def build_exercise_session_analysis(result: dict[str, Any]) -> dict[str, Any]:
    session = result["session"]
    feedback = result.get("feedback")
    if session.get("status") not in {"completed", "stopped"}:
        raise ValueError("Exercise session is not finished")
    if not feedback:
        raise ValueError("Exercise session feedback is required")

    difficulty_labels = {1: "매우 쉬움", 2: "쉬움", 3: "보통", 4: "어려움", 5: "매우 어려움"}
    condition_labels = {
        "very_bad": "매우 나쁨",
        "bad": "나쁨",
        "normal": "보통",
        "good": "좋음",
        "very_good": "매우 좋음",
    }
    completion_rate = float(session.get("completion_rate") or 0)
    duration_minutes = round(float(session.get("total_duration_seconds") or 0) / 60, 1)
    calories_burned = float(session.get("total_calories_burned") or 0)
    difficulty = int(feedback["perceived_difficulty"])
    post_condition = feedback["post_condition"]
    areas = feedback.get("uncomfortable_areas") or []

    insights: list[str] = []
    adjustments: list[str] = []
    if completion_rate >= 80:
        insights.append("계획한 운동을 안정적으로 수행했습니다.")
    else:
        insights.append("완료하지 못한 운동을 다음 루틴에서 무리 없이 다시 구성합니다.")
    if difficulty >= 4:
        insights.append("체감 난이도가 높았습니다.")
        adjustments.append("다음 운동 강도를 한 단계 낮춤")
    if post_condition in {"bad", "very_bad"}:
        insights.append("운동 후 컨디션 회복이 필요합니다.")
        adjustments.append("다음 운동 시간을 약 20% 단축")
    if areas:
        insights.append(f"불편 부위가 기록되었습니다: {', '.join(areas)}")
        adjustments.append("불편 부위의 부담이 적은 동작으로 교체")
    if not adjustments:
        adjustments.append("현재 운동 강도와 구성을 유지")

    return {
        "generator": "rules_v1",
        "summary": (
            "오늘 운동을 완료했습니다."
            if session["status"] == "completed"
            else "상태 변화를 반영해 오늘 운동을 종료했습니다."
        ),
        "metrics": {
            "completion_rate": completion_rate,
            "duration_minutes": duration_minutes,
            "calories_burned": calories_burned,
        },
        "feedback_summary": {
            "difficulty": difficulty_labels[difficulty],
            "post_condition": condition_labels[post_condition],
            "uncomfortable_areas": areas,
        },
        "insights": insights,
        "next_session_adjustments": adjustments,
        "safety_notice": (
            "통증, 어지럼 또는 호흡 불편이 지속되거나 심해지면 운동을 중단하고 전문가와 상담하세요."
            if areas or post_condition in {"bad", "very_bad"}
            else None
        ),
    }


app = FastAPI(title="Auto-Fit API", version="0.1.0")


@app.exception_handler(HTTPException)
async def chat_http_error(request, exc):
    if request.url.path.startswith("/api/chats") and not isinstance(exc.detail, dict):
        code = "AUTH_REQUIRED" if exc.status_code == 401 else "DATA_SOURCE_ERROR"
        message = "로그인이 필요하거나 세션이 만료되었습니다." if exc.status_code == 401 else "요청을 처리하지 못했습니다."
        return JSONResponse(status_code=exc.status_code, content={"detail": {"code": code, "message": message, "fields": None}})
    return await http_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def chat_validation_error(request, exc):
    if request.url.path.startswith("/api/chats"):
        # Do not echo question text, tokens, or arbitrary input in validation errors.
        return JSONResponse(status_code=422, content={"detail": {
            "code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요.",
            "fields": [".".join(map(str, error["loc"])) for error in exc.errors()],
        }})
    return await request_validation_exception_handler(request, exc)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_ORIGIN", "http://localhost:3000"),
        "http://localhost:8081",  # Approved Expo Web origin for the shared dev API.
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/test/roundtrip")
async def roundtrip(
    body: RoundtripRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    profile = await fetch_profile(user.id, settings)
    return {
        "ok": True,
        "message": body.message,
        "received_at": datetime.now(UTC).isoformat(),
        "user_id": user.id,
        "profile": profile,
    }


@app.patch("/api/profile")
async def save_profile(
    body: ProfileUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    updates = body.model_dump(mode="json", exclude_unset=True)
    profile = await update_profile(user.id, updates, settings)
    return {"ok": True, "profile": profile}


@app.get("/api/allergies")
async def get_allergies(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    catalog = await fetch_allergy_catalog(settings)
    selected = await fetch_user_allergies(user.id, settings)
    return {"catalog": catalog, "selected": selected}


@app.put("/api/allergies")
async def save_allergies(
    body: AllergySelectionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    selected = await replace_user_allergies(user.id, body, settings)
    return {"ok": True, "selected": selected}


@app.post("/api/onboarding/complete")
async def complete_onboarding(
    body: CompleteOnboardingRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    profile = await fetch_profile(user.id, settings)
    if profile.get("onboarding_completed_at"):
        return {"ok": True, "already_completed": True, "profile": profile}

    required_fields = ("name", "birth_date", "gender")
    missing_fields = [field for field in required_fields if not profile.get(field)]
    if missing_fields:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Required profile fields are missing",
                "fields": missing_fields,
            },
        )

    completed_at = datetime.now(UTC).isoformat()
    completed_profile = await update_profile(
        user.id,
        {"onboarding_completed_at": completed_at},
        settings,
    )
    return {
        "ok": True,
        "already_completed": False,
        "profile": completed_profile,
    }


@app.get("/api/exercise/preferences")
async def get_exercise_preferences(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    preferences = await fetch_exercise_preferences(user.id, settings)
    return {"preferences": preferences}


@app.put("/api/exercise/preferences")
async def save_exercise_preferences(
    body: ExercisePreferencesRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    preferences = await upsert_exercise_preferences(user.id, body, settings)
    return {"ok": True, "preferences": preferences}


@app.get("/api/exercise/recommendation-contexts/latest")
async def get_latest_exercise_recommendation_context(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    context = await fetch_latest_exercise_context(user.id, settings)
    return {"context": context}


@app.post("/api/exercise/recommendation-contexts")
async def save_exercise_recommendation_context(
    body: ExerciseRecommendationContextRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    context = await create_exercise_context(user.id, body, settings)
    return {"ok": True, "context": context}


@app.get("/api/exercise/recommendations/latest")
async def get_latest_exercise_recommendation(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await fetch_latest_exercise_recommendation(user.id, settings)
    return {"result": result}


@app.post("/api/exercise/recommendations/generate")
async def generate_exercise_recommendation(
    body: GenerateExerciseRecommendationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    preferences = await fetch_exercise_preferences(user.id, settings)
    if not preferences:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Exercise preferences are required before generating a recommendation",
        )

    context = await fetch_latest_unlinked_exercise_context(user.id, settings)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A new exercise recommendation context is required",
        )

    plan = build_exercise_recommendation_plan(preferences, context)
    result = await create_exercise_recommendation(
        user.id,
        context["exercise_recommendation_context_id"],
        plan,
        settings,
    )
    return {"ok": True, "generator": "rules_v1", "result": result}


@app.post("/api/exercise/sessions/start")
async def start_exercise_session(
    body: StartExerciseSessionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    latest = await fetch_latest_exercise_recommendation(user.id, settings)
    if not latest or latest["recommendation"]["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active exercise recommendation is required",
        )
    result = await call_exercise_session_rpc(
        "start_exercise_session",
        {
            "p_user_id": user.id,
            "p_recommendation_id": latest["recommendation"]["exercise_recommendation_id"],
        },
        settings,
    )
    return {"ok": True, "result": result}


@app.post("/api/exercise/sessions/{session_id}/items/{item_id}")
async def record_exercise_item_result(
    session_id: UUID,
    item_id: UUID,
    body: ExerciseItemResultRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await call_exercise_session_rpc(
        "record_exercise_item_result",
        {
            "p_user_id": user.id,
            "p_session_id": str(session_id),
            "p_item_id": str(item_id),
            **{
                f"p_{key}": value
                for key, value in body.model_dump(mode="json").items()
            },
        },
        settings,
    )
    return {"ok": True, "result": result}


@app.post("/api/exercise/sessions/{session_id}/complete")
async def complete_exercise_session(
    session_id: UUID,
    body: CompleteExerciseSessionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await call_exercise_session_rpc(
        "complete_exercise_session",
        {"p_user_id": user.id, "p_session_id": str(session_id)},
        settings,
    )
    return {"ok": True, "result": result}


@app.get("/api/exercise/sessions/latest")
async def get_latest_exercise_session(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await fetch_latest_exercise_session(user.id, settings)
    return {"result": result}


@app.post("/api/exercise/sessions/{session_id}/discomfort")
async def record_exercise_discomfort(
    session_id: UUID,
    body: ExerciseDiscomfortRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await call_exercise_session_rpc(
        "record_exercise_discomfort",
        {
            "p_user_id": user.id,
            "p_session_id": str(session_id),
            "p_item_id": str(body.exercise_item_id) if body.exercise_item_id else None,
            "p_symptom_type": body.symptom_type,
            "p_severity": body.severity,
            "p_body_areas": body.body_areas,
            "p_detail": body.detail,
            "p_action_taken": body.action_taken,
        },
        settings,
    )
    return {"ok": True, "result": result}


@app.get("/api/exercise/sessions/{session_id}/discomfort")
async def get_exercise_discomfort(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    logs = await fetch_exercise_discomfort_logs(user.id, str(session_id), settings)
    return {"logs": logs}


@app.put("/api/exercise/sessions/{session_id}/feedback")
async def put_exercise_session_feedback(
    session_id: UUID,
    body: ExerciseSessionFeedbackRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    feedback = await save_exercise_session_feedback(
        user.id, str(session_id), body, settings
    )
    return {"ok": True, "feedback": feedback}


@app.get("/api/exercise/sessions/{session_id}/feedback")
async def get_exercise_session_feedback(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    feedback = await fetch_exercise_session_feedback(
        user.id, str(session_id), settings
    )
    return {"feedback": feedback}


@app.get("/api/exercise/sessions/{session_id}/analysis")
async def get_exercise_session_analysis(
    session_id: UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await fetch_exercise_session_result(user.id, str(session_id), settings)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise session not found",
        )
    try:
        analysis = build_exercise_session_analysis(result)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error
    return {"analysis": analysis, "result": result}


@app.get("/api/exercise/goals/active")
async def get_active_exercise_goal(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    goal = await fetch_active_exercise_goal(user.id, settings)
    return {"goal": goal}


@app.put("/api/exercise/goals/active")
async def put_active_exercise_goal(
    body: ExerciseGoalRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    goal = await save_active_exercise_goal(user.id, body, settings)
    return {"ok": True, "goal": goal}


@app.get("/api/exercise/history")
async def get_exercise_history(
    from_date: date,
    to_date: date,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from_date must be on or before to_date",
        )
    if (to_date - from_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Exercise history range cannot exceed 367 days",
        )
    history = await fetch_exercise_history(user.id, from_date, to_date, settings)
    return {
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "count": len(history),
        "history": history,
    }


@app.get("/api/exercise/progress")
async def get_exercise_progress(
    period: Literal["week", "month", "three_months"] = Query(default="month"),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    from_date, to_date = exercise_progress_range(period)
    goal = await fetch_active_exercise_goal(user.id, settings)
    history = await fetch_exercise_history(user.id, from_date, to_date, settings)
    category_map = await fetch_exercise_category_map(history, settings)
    return {
        "progress": build_exercise_progress(
            goal, history, category_map, from_date, to_date
        )
    }


@app.get("/api/diet/inventory")
async def get_diet_inventory(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    inventory = await fetch_food_inventory(user.id, settings)
    return {"count": len(inventory), "inventory": inventory}


@app.post("/api/diet/inventory", status_code=status.HTTP_201_CREATED)
async def post_diet_inventory(
    body: FoodInventoryCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    item = await create_food_inventory_item(user.id, body, settings)
    return {"ok": True, "item": item}


@app.get("/api/diet/recommendations/latest")
async def get_latest_diet_recommendation(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await fetch_latest_diet_recommendation(user.id, settings)
    return {"result": result}


@app.post("/api/diet/recommendations/generate")
async def generate_diet_recommendation(
    body: GenerateDietRecommendationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    inventory = await fetch_food_inventory(user.id, settings)
    catalog = await fetch_allergy_catalog(settings)
    selected = await fetch_user_allergies(user.id, settings)
    catalog_names = {
        row["allergy_type_id"]: row["name"] for row in catalog
    }
    allergy_names = [
        row.get("custom_name") or catalog_names.get(row.get("allergy_type_id"))
        for row in selected
    ]
    plan = build_diet_recommendation_plan(
        inventory,
        [name for name in allergy_names if name],
    )
    await create_diet_recommendation(user.id, plan, settings)
    result = await fetch_latest_diet_recommendation(user.id, settings)
    return {"ok": True, "generator": "rules_v1", "result": result}


@app.post("/api/diet/meals/{diet_meal_id}/feedback")
async def post_diet_meal_feedback(
    diet_meal_id: UUID,
    body: DietMealFeedbackRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    result = await record_recommended_meal(
        user.id, str(diet_meal_id), body, settings
    )
    return {"ok": True, "result": result}


@app.get("/api/diet/meal-logs")
async def get_diet_meal_logs(
    from_date: date,
    to_date: date,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if from_date > to_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="from_date must be on or before to_date",
        )
    if (to_date - from_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Meal log range cannot exceed 367 days",
        )
    logs = await fetch_meal_logs(user.id, from_date, to_date, settings)
    return {
        "period": {"from": from_date.isoformat(), "to": to_date.isoformat()},
        "count": len(logs),
        "logs": logs,
    }


def get_chat_limiter(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> ChatRateLimiter:
    return ChatRateLimiter(settings.supabase_url, service_headers(settings), user.id)


async def get_chat_access(limiter: ChatRateLimiter = Depends(get_chat_limiter)):
    await limiter.check("requests")
    return limiter


@app.post("/api/chats/health-score-preview")
async def preview_health_score_answer(
    body: HealthScorePreviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    limiter: ChatRateLimiter = Depends(get_chat_access),
) -> dict[str, Any]:
    await limiter.check("answers")
    rows = await fetch_scores(settings.supabase_url, service_headers(settings), user.id)
    return {"answer": build_score_answer(rows, body.mode, body.explain)}


@app.post("/api/chats/answer-preview")
async def preview_chat_answer(
    body: ChatAnswerPreviewRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    limiter: ChatRateLimiter = Depends(get_chat_access),
) -> dict[str, Any]:
    await limiter.check("answers")
    async def load_scores():
        return await fetch_scores(settings.supabase_url, service_headers(settings), user.id)

    async def load_records(intent, period):
        return await answer_records(intent, period, settings.supabase_url, service_headers(settings), user.id)

    return {"answer": await answer_question(body.content, load_scores, load_records)}


def get_chat_store(
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    limiter: ChatRateLimiter = Depends(get_chat_access),
) -> ChatStore:
    return ChatStore(settings.supabase_url, service_headers(settings), user.id)


@app.post("/api/chats", status_code=201)
async def create_chat(body: CreateChatRequest | None = None, store: ChatStore = Depends(get_chat_store)):
    return await store.create(body.title if body else None)


@app.get("/api/chats")
async def list_chats(
    status: Literal["active", "archived"] | None = None,
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = Query(default=None, max_length=1000),
    store: ChatStore = Depends(get_chat_store),
):
    return await store.list_chats(status, limit, cursor)


@app.patch("/api/chats/{chat_id}")
async def update_chat(chat_id: UUID, body: UpdateChatRequest, store: ChatStore = Depends(get_chat_store)):
    return await store.update(str(chat_id), body.model_dump(exclude_unset=True))


@app.get("/api/chats/{chat_id}/messages")
async def list_chat_messages(
    chat_id: UUID, limit: int = Query(default=30, ge=1, le=100),
    before: str | None = Query(default=None, max_length=1000),
    store: ChatStore = Depends(get_chat_store),
):
    return await store.messages(str(chat_id), limit, before)


@app.post("/api/chats/{chat_id}/messages", status_code=201)
async def send_chat_message(
    chat_id: UUID, body: ChatMessageRequest, response: Response,
    store: ChatStore = Depends(get_chat_store),
    limiter: ChatRateLimiter = Depends(get_chat_access),
):
    async def load_scores():
        return await fetch_scores(store.url, store.headers, store.user_id)

    async def load_records(intent, period):
        return await answer_records(intent, period, store.url, store.headers, store.user_id)

    try:
        async with asyncio.timeout(30):
            result = await store.exchange(chat_id, body.client_message_id, body.content)
            if result is None:
                await limiter.check("answers")
                answer = await answer_question(body.content, load_scores, load_records)
                result = await store.exchange(chat_id, body.client_message_id, body.content, answer)
    except TimeoutError:
        chat_fail("DATA_SOURCE_ERROR")
    if result is None:
        chat_fail("DATA_SOURCE_ERROR")
    response.status_code = 200 if result["is_replay"] else 201
    return result
