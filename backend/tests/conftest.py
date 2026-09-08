"""Unit tests isolate the new external quota dependency; live scripts do not use this."""
import pytest
from backend.app import main


@pytest.fixture(autouse=True)
def isolate_chat_quota():
    class UnlimitedTestQuota:
        async def check(self, bucket):
            pass
    previous = main.app.dependency_overrides.get(main.get_chat_limiter)
    main.app.dependency_overrides[main.get_chat_limiter] = lambda: UnlimitedTestQuota()
    yield
    if previous is None:
        main.app.dependency_overrides.pop(main.get_chat_limiter, None)
    else:
        main.app.dependency_overrides[main.get_chat_limiter] = previous
