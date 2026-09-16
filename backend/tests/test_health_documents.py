import asyncio
import httpx
import pytest
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient

from backend.app import health_documents, main
from backend.tests.test_main import TEST_SETTINGS


USER_ID = "3388350b-2b51-4784-a258-7d7f505fa311"
FILE_ID = "20260916-0000-4000-8000-000000000002"


async def fake_user() -> main.AuthenticatedUser:
    return main.AuthenticatedUser(id=USER_ID)


def override_dependencies() -> None:
    main.app.dependency_overrides[main.get_current_user] = fake_user
    main.app.dependency_overrides[main.get_settings] = lambda: TEST_SETTINGS


def test_upload_endpoint_uses_authenticated_user(monkeypatch) -> None:
    captured = {}

    async def fake_create_document(**kwargs):
        captured.update(kwargs)
        return {"file": {"uploaded_file_id": FILE_ID}, "ocr_result": {"status": "completed"}}

    monkeypatch.setattr(health_documents, "_create_document", fake_create_document)
    override_dependencies()
    try:
        response = TestClient(main.app).post(
            "/api/health-documents",
            data={"document_type": "health_checkup"},
            files={"file": ("checkup.pdf", b"%PDF-1.7\n", "application/pdf")},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 201
    assert captured["user_id"] == USER_ID
    assert captured["document_type"] == "health_checkup"
    assert captured["settings"] == TEST_SETTINGS
    assert captured["file"].filename == "checkup.pdf"


def test_upload_endpoint_rejects_unknown_document_type() -> None:
    override_dependencies()
    try:
        response = TestClient(main.app).post(
            "/api/health-documents",
            data={"document_type": "prescription"},
            files={"file": ("checkup.pdf", b"%PDF-1.7\n", "application/pdf")},
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"]["fields"] == ["body.document_type"]


def test_upload_validation_uses_magic_bytes_not_filename() -> None:
    # Starlette expects a file-like object; BytesIO keeps this unit test in memory.
    from io import BytesIO

    valid = UploadFile(filename="wrong.txt", file=BytesIO(b"%PDF-1.7\n"))
    content, media_type, extension = asyncio.run(
        health_documents._read_validated_upload(valid)
    )
    assert content == b"%PDF-1.7\n"
    assert (media_type, extension) == ("application/pdf", ".pdf")

    disguised = UploadFile(filename="attack.pdf", file=BytesIO(b"not a pdf"))
    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(health_documents._read_validated_upload(disguised))
    assert exc_info.value.status_code == 415


def test_health_data_validation_rejects_unknown_or_missing_fields() -> None:
    with pytest.raises(HTTPException) as unknown:
        health_documents._validate_extracted_data(
            "health_checkup",
            {"checkup_date": "2026-09-16", "user_id": "another-user"},
            require_measurement_date=True,
        )
    assert unknown.value.status_code == 422
    assert unknown.value.detail["fields"] == ["extracted_data.user_id"]

    with pytest.raises(HTTPException) as missing:
        health_documents._validate_extracted_data(
            "body_composition",
            {"weight_kg": 70},
            require_measurement_date=True,
        )
    assert missing.value.detail["fields"] == ["extracted_data.measured_at"]


def test_document_query_is_owner_scoped(monkeypatch) -> None:
    calls = []
    responses = [
        httpx.Response(
            200,
            json=[
                {
                    "uploaded_file_id": FILE_ID,
                    "document_type": "health_checkup",
                    "storage_path": f"{USER_ID}/2026/09/{FILE_ID}.pdf",
                }
            ],
        ),
        httpx.Response(200, json=[]),
    ]

    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["trust_env"] is False

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, headers, params):
            calls.append((url, params))
            return responses.pop(0)

    monkeypatch.setattr(health_documents.httpx, "AsyncClient", FakeClient)
    result = asyncio.run(
        health_documents._fetch_document(FILE_ID, USER_ID, TEST_SETTINGS)
    )

    assert result["file"]["uploaded_file_id"] == FILE_ID
    assert calls[0][1]["user_id"] == f"eq.{USER_ID}"
    assert calls[0][1]["uploaded_file_id"] == f"eq.{FILE_ID}"


def test_health_document_routes_are_in_openapi() -> None:
    paths = main.app.openapi()["paths"]
    assert set(paths["/api/health-documents"]) == {"post"}
    assert set(paths["/api/health-documents/{uploaded_file_id}"]) == {"get"}
    assert set(paths["/api/health-documents/{uploaded_file_id}/ocr-result"]) == {"patch"}
    assert set(paths["/api/health-documents/{uploaded_file_id}/confirm"]) == {"post"}


def test_ocr_update_endpoint_rejects_client_identity(monkeypatch) -> None:
    called = False

    async def fake_update(*args, **kwargs):
        nonlocal called
        called = True

    monkeypatch.setattr(health_documents, "_update_ocr_result", fake_update)
    override_dependencies()
    try:
        response = TestClient(main.app).patch(
            f"/api/health-documents/{FILE_ID}/ocr-result",
            json={
                "extracted_data": {"checkup_date": "2026-09-16"},
                "user_id": "another-user",
            },
        )
    finally:
        main.app.dependency_overrides.clear()

    assert response.status_code == 422
    assert response.json()["detail"]["fields"] == ["body.user_id"]
    assert called is False


def test_confirm_health_checkup_maps_reviewed_data_and_user(monkeypatch) -> None:
    calls = []

    def response(status_code, payload):
        return httpx.Response(status_code, json=payload)

    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["trust_env"] is False

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, headers, params):
            calls.append(("GET", url, params, None))
            if url.endswith("/upload_files"):
                return response(
                    200,
                    [
                        {
                            "uploaded_file_id": FILE_ID,
                            "document_type": "health_checkup",
                            "upload_status": "processing",
                            "processing_status": "awaiting_review",
                        }
                    ],
                )
            if url.endswith("/ocr_results"):
                return response(
                    200,
                    [
                        {
                            "ocr_result_id": "20260916-0000-4000-8000-000000000016",
                            "status": "completed",
                            "extracted_data": {
                                "checkup_date": "2026-09-16",
                                "weight_kg": "68.4",
                            },
                        }
                    ],
                )
            if url.endswith("/health_checkups"):
                assert params["user_id"] == f"eq.{USER_ID}"
                return response(200, [])
            raise AssertionError(url)

        async def post(self, url, headers, params, json):
            calls.append(("POST", url, params, json))
            assert url.endswith("/health_checkups")
            return response(201, [{**json, "created_at": "2026-09-16T00:00:00Z"}])

        async def patch(self, url, headers, params, json):
            calls.append(("PATCH", url, params, json))
            assert params["user_id"] == f"eq.{USER_ID}"
            return response(200, [{"uploaded_file_id": FILE_ID, **json}])

    monkeypatch.setattr(health_documents.httpx, "AsyncClient", FakeClient)
    result = asyncio.run(
        health_documents._confirm_document(FILE_ID, USER_ID, TEST_SETTINGS)
    )

    create_call = next(call for call in calls if call[0] == "POST")
    assert create_call[3]["user_id"] == USER_ID
    assert create_call[3]["uploaded_file_id"] == FILE_ID
    assert create_call[3]["source_type"] == "manual"
    assert create_call[3]["checkup_date"] == "2026-09-16"
    assert create_call[3]["weight_kg"] == "68.4"
    assert result["already_confirmed"] is False
    assert result["file"]["processing_status"] == "manually_confirmed"


def test_confirm_is_idempotent_when_health_data_already_exists(monkeypatch) -> None:
    post_called = False

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, traceback):
            return None

        async def get(self, url, headers, params):
            if url.endswith("/upload_files"):
                return httpx.Response(
                    200,
                    json=[{"uploaded_file_id": FILE_ID, "document_type": "body_composition"}],
                )
            if url.endswith("/ocr_results"):
                return httpx.Response(
                    200,
                    json=[
                        {
                            "status": "completed",
                            "extracted_data": {"measured_at": "2026-09-16T09:00:00+09:00"},
                        }
                    ],
                )
            return httpx.Response(
                200,
                json=[{"body_composition_id": "existing", "uploaded_file_id": FILE_ID}],
            )

        async def post(self, *args, **kwargs):
            nonlocal post_called
            post_called = True
            raise AssertionError("idempotent confirmation must not insert again")

    monkeypatch.setattr(health_documents.httpx, "AsyncClient", FakeClient)
    result = asyncio.run(
        health_documents._confirm_document(FILE_ID, USER_ID, TEST_SETTINGS)
    )

    assert result["already_confirmed"] is True
    assert result["health_data"]["body_composition_id"] == "existing"
    assert post_called is False
