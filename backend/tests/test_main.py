from fastapi.testclient import TestClient

from backend.app import main


TEST_SETTINGS = main.Settings(
    supabase_url="https://example.supabase.co",
    supabase_publishable_key="sb_publishable_test",
    supabase_service_role_key="server-only-test-key",
    frontend_origin="http://localhost:3000",
)


def test_health() -> None:
    client = TestClient(main.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_roundtrip_returns_message_and_profile(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="user-123", email="user@example.com")

    async def fake_profile(user_id: str, settings: main.Settings):
        assert user_id == "user-123"
        assert settings == TEST_SETTINGS
        return {"user_id": user_id, "name": "테스트 사용자"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_profile", fake_profile)

    try:
        client = TestClient(main.app)
        response = client.post(
            "/api/test/roundtrip",
            json={"message": "Auto-Fit 연결 테스트"},
        )
        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True
        assert payload["message"] == "Auto-Fit 연결 테스트"
        assert payload["profile"]["user_id"] == "user-123"
    finally:
        main.app.dependency_overrides.clear()


def test_roundtrip_rejects_empty_message() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="user-123")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.post("/api/test/roundtrip", json={"message": ""})
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_secret_key_is_only_sent_as_apikey() -> None:
    settings = main.Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="sb_publishable_test",
        supabase_service_role_key="sb_secret_server_test",
        frontend_origin="http://localhost:3000",
    )
    headers = main.service_headers(settings)
    assert headers == {"apikey": "sb_secret_server_test"}


def test_profile_update_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_update(user_id: str, updates: dict, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert updates == {"nickname": "새 닉네임"}
        assert settings == TEST_SETTINGS
        return {"user_id": user_id, **updates}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "update_profile", fake_update)

    try:
        client = TestClient(main.app)
        response = client.patch("/api/profile", json={"nickname": " 새 닉네임 "})
        assert response.status_code == 200
        assert response.json()["profile"] == {
            "user_id": "authenticated-user",
            "nickname": "새 닉네임",
        }
    finally:
        main.app.dependency_overrides.clear()


def test_profile_update_rejects_client_supplied_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.patch(
            "/api/profile",
            json={"nickname": "공격 시도", "user_id": "another-user"},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_profile_get_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_profile(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return {
            "user_id": user_id,
            "name": "테스트 사용자",
            "onboarding_completed_at": None,
        }

    async def fake_preferences(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return {"goal_type": "maintenance", "experience_level": "beginner"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_profile", fake_profile)
    monkeypatch.setattr(main, "fetch_exercise_preferences", fake_preferences)

    try:
        client = TestClient(main.app)
        response = client.get("/api/profile")
        assert response.status_code == 200
        assert response.json()["profile"]["user_id"] == "authenticated-user"
        assert response.json()["exercise_preferences"]["goal_type"] == "maintenance"
    finally:
        main.app.dependency_overrides.clear()


def test_profile_update_rejects_empty_payload() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.patch("/api/profile", json={})
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_allergy_save_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_replace(
        user_id: str,
        selection: main.AllergySelectionRequest,
        settings: main.Settings,
    ):
        assert user_id == "authenticated-user"
        assert [str(value) for value in selection.allergy_type_ids] == [
            "687d6d0f-a5bc-48f8-b924-3536744f21d2"
        ]
        assert selection.custom_names == ["토마토"]
        assert settings == TEST_SETTINGS
        return [{"allergy_type_id": str(selection.allergy_type_ids[0])}]

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "replace_user_allergies", fake_replace)

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/allergies",
            json={
                "allergy_type_ids": ["687d6d0f-a5bc-48f8-b924-3536744f21d2"],
                "custom_names": [" 토마토 ", "토마토"],
            },
        )
        assert response.status_code == 200
        assert response.json()["ok"] is True
    finally:
        main.app.dependency_overrides.clear()


def test_allergy_save_rejects_client_supplied_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/allergies",
            json={
                "allergy_type_ids": [],
                "custom_names": [],
                "user_id": "another-user",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_allergy_save_rejects_blank_custom_name() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/allergies",
            json={"allergy_type_ids": [], "custom_names": ["   "]},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_onboarding_completion_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_profile(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return {
            "user_id": user_id,
            "name": "테스트 사용자",
            "birth_date": "1990-01-01",
            "gender": "other",
            "onboarding_completed_at": None,
        }

    async def fake_update(user_id: str, updates: dict, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        assert set(updates) == {"onboarding_completed_at"}
        assert updates["onboarding_completed_at"].endswith("+00:00")
        return {
            "user_id": user_id,
            "onboarding_completed_at": updates["onboarding_completed_at"],
        }

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_profile", fake_profile)
    monkeypatch.setattr(main, "update_profile", fake_update)

    try:
        client = TestClient(main.app)
        response = client.post("/api/onboarding/complete", json={})
        assert response.status_code == 200
        assert response.json()["ok"] is True
        assert response.json()["already_completed"] is False
    finally:
        main.app.dependency_overrides.clear()


def test_onboarding_completion_rejects_missing_required_profile_fields(
    monkeypatch,
) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_profile(user_id: str, settings: main.Settings):
        return {
            "user_id": user_id,
            "name": "테스트 사용자",
            "birth_date": None,
            "gender": None,
            "onboarding_completed_at": None,
        }

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_profile", fake_profile)

    try:
        client = TestClient(main.app)
        response = client.post("/api/onboarding/complete", json={})
        assert response.status_code == 409
        assert response.json()["detail"]["fields"] == ["birth_date", "gender"]
    finally:
        main.app.dependency_overrides.clear()


def test_onboarding_completion_rejects_client_supplied_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.post(
            "/api/onboarding/complete",
            json={"user_id": "another-user"},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_preferences_save_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_upsert(
        user_id: str,
        preferences: main.ExercisePreferencesRequest,
        settings: main.Settings,
    ):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        assert preferences.goal_type == "rehabilitation"
        assert preferences.experience_level == "beginner"
        return {"user_id": user_id, **preferences.model_dump()}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "upsert_exercise_preferences", fake_upsert)

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/exercise/preferences",
            json={"goal_type": "rehabilitation", "experience_level": "beginner"},
        )
        assert response.status_code == 200
        assert response.json()["preferences"]["user_id"] == "authenticated-user"
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_preferences_rejects_client_supplied_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/exercise/preferences",
            json={
                "goal_type": "maintenance",
                "experience_level": "advanced",
                "user_id": "another-user",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_preferences_rejects_unknown_goal() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.put(
            "/api/exercise/preferences",
            json={"goal_type": "invalid", "experience_level": "beginner"},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_context_save_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_create(
        user_id: str,
        context: main.ExerciseRecommendationContextRequest,
        settings: main.Settings,
    ):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        assert context.available_minutes == 60
        assert context.location == "gym"
        assert context.available_equipment == ["machine", "mat"]
        assert context.condition_level == "normal"
        assert context.discomfort_areas == ["허리"]
        assert context.condition_note is None
        return {"user_id": user_id, **context.model_dump()}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "create_exercise_context", fake_create)

    try:
        client = TestClient(main.app)
        response = client.post(
            "/api/exercise/recommendation-contexts",
            json={
                "available_minutes": 60,
                "location": "gym",
                "available_equipment": ["machine", "mat", "machine"],
                "condition_level": " normal ",
                "discomfort_areas": [" 허리 ", "허리"],
                "condition_note": "   ",
            },
        )
        assert response.status_code == 200
        assert response.json()["context"]["user_id"] == "authenticated-user"
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_context_rejects_client_supplied_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.post(
            "/api/exercise/recommendation-contexts",
            json={
                "available_minutes": 30,
                "location": "home",
                "available_equipment": [],
                "condition_level": "good",
                "discomfort_areas": [],
                "user_id": "another-user",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_context_rejects_unknown_equipment_and_blank_area() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        invalid_equipment = client.post(
            "/api/exercise/recommendation-contexts",
            json={
                "available_minutes": 30,
                "location": "home",
                "available_equipment": ["treadmill"],
                "condition_level": "good",
                "discomfort_areas": [],
            },
        )
        blank_area = client.post(
            "/api/exercise/recommendation-contexts",
            json={
                "available_minutes": 30,
                "location": "home",
                "available_equipment": [],
                "condition_level": "good",
                "discomfort_areas": ["   "],
            },
        )
        assert invalid_equipment.status_code == 422
        assert blank_area.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_latest_exercise_context_uses_authenticated_user_id(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return {"user_id": user_id, "available_minutes": 45}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_latest_exercise_context", fake_fetch)

    try:
        client = TestClient(main.app)
        response = client.get("/api/exercise/recommendation-contexts/latest")
        assert response.status_code == 200
        assert response.json()["context"]["available_minutes"] == 45
    finally:
        main.app.dependency_overrides.clear()


def test_build_exercise_recommendation_plan_uses_context_and_preferences() -> None:
    plan = main.build_exercise_recommendation_plan(
        {"goal_type": "muscle_gain", "experience_level": "advanced"},
        {
            "available_minutes": 60,
            "available_equipment": ["machine", "mat"],
            "condition_level": "보통",
            "discomfort_areas": ["허리"],
        },
    )

    assert plan["recommendation"]["intensity"] == "low"
    assert plan["recommendation"]["total_duration_minutes"] == 60
    assert sum(item["duration_minutes"] for item in plan["items"]) == 60
    assert plan["items"][1]["exercise_type_name"] == "웨이트 트레이닝"
    assert plan["items"][1]["sets"] == 2


def test_build_exercise_recommendation_plan_uses_profile_activity_level() -> None:
    plan = main.build_exercise_recommendation_plan(
        {"goal_type": "maintenance", "experience_level": "beginner"},
        {
            "available_minutes": 30,
            "available_equipment": [],
            "condition_level": "좋음",
            "discomfort_areas": [],
        },
        {"activity_level": "sedentary"},
    )

    assert plan["recommendation"]["intensity"] == "low"
    assert "활동 수준" in plan["recommendation"]["ai_reason"]


def test_generate_exercise_recommendation_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_preferences(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        return {"goal_type": "maintenance", "experience_level": "beginner"}

    async def fake_profile(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        return {"user_id": user_id, "activity_level": "light"}

    async def fake_context(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        return {
            "exercise_recommendation_context_id": "context-123",
            "available_minutes": 30,
            "available_equipment": [],
            "condition_level": "좋음",
            "discomfort_areas": [],
        }

    async def fake_create(
        user_id: str,
        context_id: str,
        plan: dict,
        settings: main.Settings,
    ):
        assert user_id == "authenticated-user"
        assert context_id == "context-123"
        assert plan["recommendation"]["goal"] == "maintenance"
        assert plan["recommendation"]["intensity"] == "low"
        assert settings == TEST_SETTINGS
        return {"recommendation": {"user_id": user_id}, "items": plan["items"]}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_preferences", fake_preferences)
    monkeypatch.setattr(main, "fetch_profile", fake_profile)
    monkeypatch.setattr(main, "fetch_latest_unlinked_exercise_context", fake_context)
    monkeypatch.setattr(main, "create_exercise_recommendation", fake_create)

    try:
        client = TestClient(main.app)
        response = client.post("/api/exercise/recommendations/generate", json={})
        assert response.status_code == 200
        assert response.json()["generator"] == "rules_v1"
        assert len(response.json()["result"]["items"]) == 3
    finally:
        main.app.dependency_overrides.clear()


def test_generate_exercise_recommendation_requires_preferences(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_preferences(user_id: str, settings: main.Settings):
        return None

    async def fake_profile(user_id: str, settings: main.Settings):
        return {"user_id": user_id, "activity_level": "moderate"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_preferences", fake_preferences)
    monkeypatch.setattr(main, "fetch_profile", fake_profile)

    try:
        client = TestClient(main.app)
        response = client.post("/api/exercise/recommendations/generate", json={})
        assert response.status_code == 409
    finally:
        main.app.dependency_overrides.clear()


def test_generate_exercise_recommendation_rejects_client_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS

    try:
        client = TestClient(main.app)
        response = client.post(
            "/api/exercise/recommendations/generate",
            json={"user_id": "another-user"},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_latest_exercise_recommendation_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return {
            "recommendation": {"user_id": user_id},
            "items": [{"exercise_name": "빠르게 걷기"}],
        }

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_latest_exercise_recommendation", fake_fetch)

    try:
        client = TestClient(main.app)
        response = client.get("/api/exercise/recommendations/latest")
        assert response.status_code == 200
        assert response.json()["result"]["items"][0]["exercise_name"] == "빠르게 걷기"
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_item_result_requires_one_terminal_state() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/items/00000000-0000-0000-0000-000000000002",
            json={"completed": True, "skipped": True},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_item_result_requires_skip_reason() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/items/00000000-0000-0000-0000-000000000002",
            json={"completed": False, "skipped": True},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_start_exercise_session_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_latest(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        return {
            "recommendation": {
                "exercise_recommendation_id": "recommendation-123",
                "status": "active",
            },
            "items": [],
        }

    async def fake_rpc(name: str, payload: dict, settings: main.Settings):
        assert name == "start_exercise_session"
        assert payload == {
            "p_user_id": "authenticated-user",
            "p_recommendation_id": "recommendation-123",
        }
        return {"session": {"user_id": payload["p_user_id"]}, "items": []}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_latest_exercise_recommendation", fake_latest)
    monkeypatch.setattr(main, "call_exercise_session_rpc", fake_rpc)
    try:
        response = TestClient(main.app).post("/api/exercise/sessions/start", json={})
        assert response.status_code == 200
        assert response.json()["result"]["session"]["user_id"] == "authenticated-user"
    finally:
        main.app.dependency_overrides.clear()


def test_record_exercise_item_result_uses_path_ids_and_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_rpc(name: str, payload: dict, settings: main.Settings):
        assert name == "record_exercise_item_result"
        assert payload["p_user_id"] == "authenticated-user"
        assert payload["p_session_id"] == "00000000-0000-0000-0000-000000000001"
        assert payload["p_item_id"] == "00000000-0000-0000-0000-000000000002"
        assert payload["p_completed"] is True
        assert payload["p_skipped"] is False
        return {"log": {"completed": True}}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "call_exercise_session_rpc", fake_rpc)
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/items/00000000-0000-0000-0000-000000000002",
            json={"completed": True, "skipped": False, "duration_minutes": 10},
        )
        assert response.status_code == 200
        assert response.json()["result"]["log"]["completed"] is True
    finally:
        main.app.dependency_overrides.clear()


def test_complete_exercise_session_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_rpc(name: str, payload: dict, settings: main.Settings):
        assert name == "complete_exercise_session"
        assert payload["p_user_id"] == "authenticated-user"
        return {"session": {"status": "completed"}, "logs": []}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "call_exercise_session_rpc", fake_rpc)
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/complete",
            json={},
        )
        assert response.status_code == 200
        assert response.json()["result"]["session"]["status"] == "completed"
    finally:
        main.app.dependency_overrides.clear()


def test_latest_exercise_session_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        return {"session": {"status": "completed"}, "logs": [{"completed": True}]}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_latest_exercise_session", fake_fetch)
    try:
        response = TestClient(main.app).get("/api/exercise/sessions/latest")
        assert response.status_code == 200
        assert response.json()["result"]["logs"][0]["completed"] is True
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_discomfort_rejects_invalid_severity() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/discomfort",
            json={
                "symptom_type": "pain",
                "severity": 11,
                "body_areas": ["허리"],
                "action_taken": "adjust",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_record_exercise_discomfort_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_rpc(name: str, payload: dict, settings: main.Settings):
        assert name == "record_exercise_discomfort"
        assert payload["p_user_id"] == "authenticated-user"
        assert payload["p_session_id"] == "00000000-0000-0000-0000-000000000001"
        assert payload["p_item_id"] == "00000000-0000-0000-0000-000000000002"
        assert payload["p_body_areas"] == ["허리"]
        assert payload["p_action_taken"] == "adjust"
        return {"discomfort": {"severity": 6}, "adjusted_items": [{"intensity": "low"}]}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "call_exercise_session_rpc", fake_rpc)
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/discomfort",
            json={
                "exercise_item_id": "00000000-0000-0000-0000-000000000002",
                "symptom_type": "pain",
                "severity": 6,
                "body_areas": [" 허리 ", "허리"],
                "detail": " 조금 아픔 ",
                "action_taken": "adjust",
            },
        )
        assert response.status_code == 200
        assert len(response.json()["result"]["adjusted_items"]) == 1
    finally:
        main.app.dependency_overrides.clear()


def test_record_exercise_discomfort_rejects_client_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/discomfort",
            json={
                "user_id": "another-user",
                "symptom_type": "fatigue",
                "severity": 5,
                "body_areas": [],
                "action_taken": "continue",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_get_exercise_discomfort_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id: str, session_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert session_id == "00000000-0000-0000-0000-000000000001"
        return [{"symptom_type": "fatigue", "severity": 4}]

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_discomfort_logs", fake_fetch)
    try:
        response = TestClient(main.app).get(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/discomfort"
        )
        assert response.status_code == 200
        assert response.json()["logs"][0]["severity"] == 4
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_feedback_rejects_invalid_difficulty() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).put(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/feedback",
            json={
                "perceived_difficulty": 6,
                "post_condition": "good",
                "uncomfortable_areas": [],
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_save_exercise_feedback_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_save(user_id, session_id, body, settings):
        assert user_id == "authenticated-user"
        assert session_id == "00000000-0000-0000-0000-000000000001"
        assert body.uncomfortable_areas == ["허리"]
        assert body.note == "운동 완료"
        assert settings == TEST_SETTINGS
        return {"perceived_difficulty": 3, "post_condition": "good"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "save_exercise_session_feedback", fake_save)
    try:
        response = TestClient(main.app).put(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/feedback",
            json={
                "perceived_difficulty": 3,
                "post_condition": "good",
                "uncomfortable_areas": [" 허리 ", "허리"],
                "note": " 운동 완료 ",
            },
        )
        assert response.status_code == 200
        assert response.json()["feedback"]["post_condition"] == "good"
    finally:
        main.app.dependency_overrides.clear()


def test_save_exercise_feedback_rejects_client_user_id() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).put(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/feedback",
            json={
                "user_id": "another-user",
                "perceived_difficulty": 3,
                "post_condition": "normal",
                "uncomfortable_areas": [],
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_get_exercise_feedback_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id, session_id, settings):
        assert user_id == "authenticated-user"
        assert session_id == "00000000-0000-0000-0000-000000000001"
        return {"perceived_difficulty": 2, "post_condition": "very_good"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_session_feedback", fake_fetch)
    try:
        response = TestClient(main.app).get(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/feedback"
        )
        assert response.status_code == 200
        assert response.json()["feedback"]["post_condition"] == "very_good"
    finally:
        main.app.dependency_overrides.clear()


def test_build_exercise_analysis_adjusts_high_difficulty_and_discomfort() -> None:
    analysis = main.build_exercise_session_analysis(
        {
            "session": {
                "status": "completed",
                "completion_rate": "100.00",
                "total_duration_seconds": 1800,
                "total_calories_burned": "150.00",
            },
            "logs": [],
            "feedback": {
                "perceived_difficulty": 5,
                "post_condition": "bad",
                "uncomfortable_areas": ["허리"],
            },
        }
    )
    assert analysis["generator"] == "rules_v1"
    assert analysis["metrics"]["duration_minutes"] == 30
    assert analysis["feedback_summary"]["difficulty"] == "매우 어려움"
    assert "다음 운동 강도를 한 단계 낮춤" in analysis["next_session_adjustments"]
    assert analysis["safety_notice"] is not None


def test_get_exercise_analysis_requires_feedback(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_result(user_id, session_id, settings):
        return {
            "session": {
                "status": "completed",
                "completion_rate": 100,
                "total_duration_seconds": 1800,
                "total_calories_burned": 150,
            },
            "logs": [],
            "feedback": None,
        }

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_session_result", fake_result)
    try:
        response = TestClient(main.app).get(
            "/api/exercise/sessions/00000000-0000-0000-0000-000000000001/analysis"
        )
        assert response.status_code == 409
        assert response.json()["detail"] == "Exercise session feedback is required"
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_goal_rejects_invalid_frequency() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).put(
            "/api/exercise/goals/active",
            json={
                "goal_type": "rehabilitation",
                "weekly_frequency": 8,
                "weekly_duration_minutes": 120,
                "goal_period_weeks": 8,
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_save_exercise_goal_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_save(user_id, body, settings):
        assert user_id == "authenticated-user"
        assert body.goal_type == "rehabilitation"
        assert body.weekly_frequency == 3
        assert settings == TEST_SETTINGS
        return {"user_id": user_id, **body.model_dump(mode="json")}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "save_active_exercise_goal", fake_save)
    try:
        response = TestClient(main.app).put(
            "/api/exercise/goals/active",
            json={
                "goal_type": "rehabilitation",
                "weekly_frequency": 3,
                "weekly_duration_minutes": 120,
                "goal_period_weeks": 8,
                "user_id": "another-user",
            },
        )
        assert response.status_code == 422

        response = TestClient(main.app).put(
            "/api/exercise/goals/active",
            json={
                "goal_type": "rehabilitation",
                "weekly_frequency": 3,
                "weekly_duration_minutes": 120,
                "goal_period_weeks": 8,
            },
        )
        assert response.status_code == 200
        assert response.json()["goal"]["user_id"] == "authenticated-user"
    finally:
        main.app.dependency_overrides.clear()


def test_get_active_exercise_goal_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id, settings):
        assert user_id == "authenticated-user"
        return {"goal_type": "maintenance"}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_active_exercise_goal", fake_fetch)
    try:
        response = TestClient(main.app).get("/api/exercise/goals/active")
        assert response.status_code == 200
        assert response.json()["goal"]["goal_type"] == "maintenance"
    finally:
        main.app.dependency_overrides.clear()


def test_exercise_history_rejects_invalid_range() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).get(
            "/api/exercise/history?from_date=2026-09-02&to_date=2026-09-01"
        )
        assert response.status_code == 422
        response = TestClient(main.app).get(
            "/api/exercise/history?from_date=2025-01-01&to_date=2026-09-01"
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_get_exercise_history_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id, from_date, to_date, settings):
        assert user_id == "authenticated-user"
        assert from_date.isoformat() == "2026-09-01"
        assert to_date.isoformat() == "2026-09-03"
        return [{"session": {"exercise_session_id": "session-1"}, "logs": []}]

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_exercise_history", fake_fetch)
    try:
        response = TestClient(main.app).get(
            "/api/exercise/history?from_date=2026-09-01&to_date=2026-09-03"
        )
        assert response.status_code == 200
        assert response.json()["count"] == 1
    finally:
        main.app.dependency_overrides.clear()


def test_build_exercise_progress_aggregates_real_session_fields() -> None:
    goal = {"weekly_frequency": 3, "weekly_duration_minutes": 120}
    history = [
        {
            "session": {
                "started_at": "2026-08-24T10:00:00+00:00",
                "completed_item_count": 2,
                "total_duration_seconds": 1800,
                "total_calories_burned": 150,
            },
            "logs": [
                {
                    "exercise_item_id": "item-1",
                    "duration_minutes": 20,
                    "completed": True,
                },
                {
                    "exercise_item_id": "item-2",
                    "duration_minutes": 10,
                    "completed": True,
                },
            ],
        },
        {
            "session": {
                "started_at": "2026-08-25T10:00:00Z",
                "completed_item_count": 1,
                "total_duration_seconds": 1200,
                "total_calories_burned": "100.5",
            },
            "logs": [
                {
                    "exercise_item_id": "item-1",
                    "duration_minutes": 20,
                    "completed": True,
                }
            ],
        },
    ]

    result = main.build_exercise_progress(
        goal,
        history,
        {"item-1": "유산소", "item-2": "유연성"},
        main.date(2026, 8, 24),
        main.date(2026, 8, 30),
    )

    assert result["summary"]["workout_count"] == 2
    assert result["summary"]["exercise_count"] == 3
    assert result["summary"]["duration_minutes"] == 50
    assert result["summary"]["calories_burned"] == 250.5
    assert result["summary"]["target_workout_count"] == 3
    assert result["weekly_trend"][0]["workout_count"] == 2
    assert result["category_distribution"][0]["category"] == "유산소"
    assert result["category_distribution"][0]["percentage"] == 80
    assert result["achievements"]["longest_workout_streak_days"] == 2


def test_exercise_progress_range_uses_calendar_boundaries() -> None:
    today = main.date(2026, 9, 3)
    assert main.exercise_progress_range("week", today)[0] == main.date(2026, 8, 31)
    assert main.exercise_progress_range("month", today)[0] == main.date(2026, 9, 1)
    assert main.exercise_progress_range("three_months", today)[0] == main.date(2026, 7, 1)


def test_get_exercise_progress_combines_goal_history_and_categories(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_goal(user_id, settings):
        return {"weekly_frequency": 3, "weekly_duration_minutes": 120}

    async def fake_history(user_id, from_date, to_date, settings):
        return []

    async def fake_categories(history, settings):
        assert history == []
        return {}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_active_exercise_goal", fake_goal)
    monkeypatch.setattr(main, "fetch_exercise_history", fake_history)
    monkeypatch.setattr(main, "fetch_exercise_category_map", fake_categories)
    try:
        response = TestClient(main.app).get("/api/exercise/progress?period=month")
        assert response.status_code == 200
        assert response.json()["progress"]["summary"]["workout_count"] == 0
    finally:
        main.app.dependency_overrides.clear()


def test_build_exercise_summary_returns_recent_and_cumulative_totals() -> None:
    sessions = [
        {
            "completed_at": "2026-09-10T01:00:00Z",
            "started_at": "2026-09-10T00:30:00Z",
            "completed_item_count": 3,
            "total_duration_seconds": 1800,
            "total_calories_burned": 150.5,
        },
        {
            "completed_at": "2026-09-03T01:00:00Z",
            "started_at": "2026-09-03T00:30:00Z",
            "completed_item_count": 2,
            "total_duration_seconds": 1200,
            "total_calories_burned": 90,
        },
    ]

    summary = main.build_exercise_summary(sessions, main.date(2026, 9, 10))

    assert summary["recent_7_days"]["period"]["from"] == "2026-09-04"
    assert summary["recent_7_days"]["workout_count"] == 1
    assert summary["recent_7_days"]["duration_minutes"] == 30
    assert summary["cumulative"]["workout_count"] == 2
    assert summary["cumulative"]["exercise_count"] == 5
    assert summary["cumulative"]["calories_burned"] == 240.5


def test_get_exercise_summary_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_sessions(user_id: str, settings: main.Settings):
        assert user_id == "authenticated-user"
        assert settings == TEST_SETTINGS
        return []

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_completed_exercise_sessions", fake_sessions)
    try:
        response = TestClient(main.app).get("/api/exercise/summary")
        assert response.status_code == 200
        assert response.json()["summary"]["recent_7_days"]["workout_count"] == 0
        assert response.json()["summary"]["cumulative"]["workout_count"] == 0
    finally:
        main.app.dependency_overrides.clear()


def test_food_inventory_rejects_invalid_date_order() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/diet/inventory",
            json={
                "name": "브로콜리",
                "purchased_on": "2026-09-03",
                "expires_on": "2026-09-02",
            },
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_create_food_inventory_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_create(user_id, body, settings):
        assert user_id == "authenticated-user"
        assert body.name == "브로콜리"
        assert str(body.quantity) == "2"
        return {"user_id": user_id, "custom_name": body.name}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "create_food_inventory_item", fake_create)
    try:
        response = TestClient(main.app).post(
            "/api/diet/inventory",
            json={"name": " 브로콜리 ", "quantity": 2, "unit": "개"},
        )
        assert response.status_code == 201
        assert response.json()["item"]["user_id"] == "authenticated-user"

        rejected = TestClient(main.app).post(
            "/api/diet/inventory",
            json={"name": "브로콜리", "user_id": "another-user"},
        )
        assert rejected.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_build_diet_plan_reflects_inventory_and_excludes_allergens() -> None:
    result = main.build_diet_recommendation_plan(
        [{"custom_name": "브로콜리"}],
        ["대두", "우유", "견과류", "생선"],
    )
    food_names = {
        food["food_name"]
        for meal in result["meals"]
        for food in meal["foods"]
    }
    assert len(result["meals"]) == 4
    assert "냉장고 반영: 브로콜리" in result["meals"][0]["recommendation_note"]
    assert not {"두부구이", "그릭요거트", "호두", "연어구이"} & food_names
    assert "알레르기 제외 식재료" in result["recommendation"]["ai_reason"]


def test_generate_diet_recommendation_uses_user_data(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_inventory(user_id, settings):
        assert user_id == "authenticated-user"
        return [{"custom_name": "브로콜리"}]

    async def fake_catalog(settings):
        return [{"allergy_type_id": "allergy-1", "name": "우유"}]

    async def fake_allergies(user_id, settings):
        return [{"allergy_type_id": "allergy-1", "custom_name": None}]

    async def fake_create(user_id, plan, settings):
        assert user_id == "authenticated-user"
        assert "그릭요거트" not in {
            food["food_name"] for meal in plan["meals"] for food in meal["foods"]
        }
        return {"diet_recommendation_id": "recommendation-1"}

    async def fake_latest(user_id, settings):
        return {"recommendation": {"diet_recommendation_id": "recommendation-1"}}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_food_inventory", fake_inventory)
    monkeypatch.setattr(main, "fetch_allergy_catalog", fake_catalog)
    monkeypatch.setattr(main, "fetch_user_allergies", fake_allergies)
    monkeypatch.setattr(main, "create_diet_recommendation", fake_create)
    monkeypatch.setattr(main, "fetch_latest_diet_recommendation", fake_latest)
    try:
        response = TestClient(main.app).post(
            "/api/diet/recommendations/generate", json={}
        )
        assert response.status_code == 200
        assert response.json()["generator"] == "rules_v1"
    finally:
        main.app.dependency_overrides.clear()


def test_changed_meal_requires_actual_items() -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    try:
        response = TestClient(main.app).post(
            "/api/diet/meals/11111111-1111-1111-1111-111111111111/feedback",
            json={"feedback_type": "different_food"},
        )
        assert response.status_code == 422
    finally:
        main.app.dependency_overrides.clear()


def test_record_meal_feedback_uses_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_record(user_id, meal_id, body, settings):
        assert user_id == "authenticated-user"
        assert meal_id == "11111111-1111-1111-1111-111111111111"
        assert body.feedback_type == "eaten"
        return {"feedback": {"feedback_type": "eaten"}}

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "record_recommended_meal", fake_record)
    try:
        response = TestClient(main.app).post(
            "/api/diet/meals/11111111-1111-1111-1111-111111111111/feedback",
            json={"feedback_type": "eaten"},
        )
        assert response.status_code == 200
        assert response.json()["result"]["feedback"]["feedback_type"] == "eaten"
    finally:
        main.app.dependency_overrides.clear()


def test_meal_logs_validate_range_and_use_authenticated_user(monkeypatch) -> None:
    async def fake_user() -> main.AuthenticatedUser:
        return main.AuthenticatedUser(id="authenticated-user")

    async def fake_fetch(user_id, from_date, to_date, settings):
        assert user_id == "authenticated-user"
        assert from_date.isoformat() == "2026-09-01"
        assert to_date.isoformat() == "2026-09-03"
        return [{"meal_log_id": "log-1", "items": []}]

    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS
    monkeypatch.setattr(main, "fetch_meal_logs", fake_fetch)
    try:
        client = TestClient(main.app)
        invalid = client.get(
            "/api/diet/meal-logs?from_date=2026-09-03&to_date=2026-09-01"
        )
        assert invalid.status_code == 422
        response = client.get(
            "/api/diet/meal-logs?from_date=2026-09-01&to_date=2026-09-03"
        )
        assert response.status_code == 200
        assert response.json()["count"] == 1
    finally:
        main.app.dependency_overrides.clear()
