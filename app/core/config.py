from functools import lru_cache

from pydantic_settings import (
    BaseSettings,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    # AI Server -> OpenAI 인증
    openai_api_key: str | None = None

    # 주간 식단 / 운동 등 기본 모델
    openai_model: str = "gpt-5"

    # 한 끼 식단 재추천 전용 빠른 모델
    openai_replace_meal_model: str = "gpt-5-mini"

    # Backend -> AI Server 인증
    ai_server_api_key: str | None = None

    app_name: str = (
        "Healthcare AI Server"
    )

    model_config = (
        SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
        )
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
