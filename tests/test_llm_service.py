from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.schemas.chat import ChatRequest
from app.services import llm_service as module


@pytest.fixture(autouse=True)
def clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_generate_uses_router_contract(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "test-model")
    captured = {}

    class Responses:
        async def create(self, **kwargs):
            captured.update(kwargs)
            return SimpleNamespace(output_text="  테스트 답변  ")

    monkeypatch.setattr(
        module,
        "AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )

    answer = await module.generate_chat_response(ChatRequest(question="질문"))

    assert answer == "테스트 답변"
    assert captured["model"] == "test-model"
    assert captured["input"] == "질문"
    assert "일반 상식" in captured["instructions"]


@pytest.mark.asyncio
async def test_generate_rejects_missing_openai_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="OPENAI_API_KEY"):
        await module.generate_chat_response(ChatRequest(question="질문"))


@pytest.mark.asyncio
async def test_generate_rejects_empty_answer(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")

    class Responses:
        async def create(self, **kwargs):
            return SimpleNamespace(output_text="   ")

    monkeypatch.setattr(
        module,
        "AsyncOpenAI",
        lambda **kwargs: SimpleNamespace(responses=Responses()),
    )

    with pytest.raises(RuntimeError, match="empty answer"):
        await module.generate_chat_response(ChatRequest(question="질문"))
