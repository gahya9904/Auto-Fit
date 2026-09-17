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
        return {"file": {"uploaded_file_id": FILE_ID, "document_type": "health_checkup", "file_name": "checkup.pdf", "uploaded_at": "2026-09-17T00:00:00Z"}, "ocr_result": {"status": "completed", "extracted_data": {"weight_kg": "70"}}}

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
    assert response.json()["uploaded_file_id"] == FILE_ID
    assert response.json()["extracted_data"]["weight_kg"] == "70"
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


def test_ocr_missing_configuration_is_failed_not_completed(monkeypatch):
    monkeypatch.setenv("HEALTH_DOCUMENT_OCR_MOCK_ENABLED", "false")
    monkeypatch.delenv("HEALTH_DOCUMENT_OCR_URL", raising=False)
    data, error = asyncio.run(health_documents._extract_document(b"%PDF-1.7", "application/pdf", "health_checkup"))
    assert error == "OCR_NOT_CONFIGURED"
    assert all(value is None for value in data.values())


@pytest.mark.parametrize("result,expected", [
    ({"document_type": "body_composition", "extracted_data": {"weight_kg": 70}}, "DOCUMENT_TYPE_MISMATCH"),
    ({"document_type": "health_checkup", "extracted_data": {}}, "EXTRACTION_FAILED"),
    ({"document_type": "health_checkup", "extracted_data": {"user_id": "injected"}}, "EXTRACTION_FAILED"),
    ({"document_type": "health_checkup", "extracted_data": {"weight_kg": 70}}, None),
    ([], "EXTRACTION_FAILED"),
])
def test_ocr_provider_response_is_validated(monkeypatch, result, expected):
    monkeypatch.setenv("HEALTH_DOCUMENT_OCR_URL", "https://ocr.example/extract")
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            assert kwargs["data"]["document_type"] == "health_checkup"
            assert "apikey" not in kwargs["headers"]
            return httpx.Response(200, json=result, request=httpx.Request("POST", url))
    monkeypatch.setattr(health_documents.httpx, "AsyncClient", Client)
    data, error = asyncio.run(health_documents._extract_document(b"%PDF-1.7", "application/pdf", "health_checkup"))
    assert error == expected
    if expected is None: assert data["weight_kg"] == "70"


@pytest.mark.parametrize("confirmed", [False, True])
def test_patch_merges_fields_and_rejects_confirmed_documents(monkeypatch, confirmed):
    document = {"file": {"uploaded_file_id": FILE_ID, "document_type": "health_checkup"},
                "ocr_result": {"status": "completed", "extracted_data": {"checkup_date": "2026-09-17", "height_cm": "175", "weight_kg": "70"}}}
    async def fetch(*args): return document
    monkeypatch.setattr(health_documents, "_fetch_document", fetch)
    patches = []
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs): return httpx.Response(200, json=[{}] if confirmed else [])
        async def patch(self, *args, **kwargs):
            patches.append(kwargs["json"])
            return httpx.Response(200, json=[{"ocr_result_id": FILE_ID}])
    monkeypatch.setattr(health_documents.httpx, "AsyncClient", Client)
    if confirmed:
        with pytest.raises(HTTPException) as exc:
            asyncio.run(health_documents._update_ocr_result(FILE_ID, {"weight_kg": None}, USER_ID, TEST_SETTINGS))
        assert exc.value.status_code == 409
        assert exc.value.detail["code"] == "DOCUMENT_CONFIRMED"
        assert not patches
    else:
        asyncio.run(health_documents._update_ocr_result(FILE_ID, {"weight_kg": None}, USER_ID, TEST_SETTINGS))
        assert patches[0]["extracted_data"]["height_cm"] == "175"
        assert patches[0]["extracted_data"]["checkup_date"] == "2026-09-17"
        assert patches[0]["extracted_data"]["weight_kg"] is None


def test_document_openapi_has_discriminator_units_and_errors():
    schema = main.app.openapi()
    operation = schema["paths"]["/api/health-documents/{uploaded_file_id}"]["get"]
    response = operation["responses"]["200"]["content"]["application/json"]["schema"]
    assert response["discriminator"]["propertyName"] == "document_type"
    assert set(operation["responses"]) >= {"401", "404", "409", "422", "502"}
    fields = schema["components"]["schemas"]["HealthCheckupData-Output"]["properties"]
    assert "cm" in fields["height_cm"]["description"]
    assert "mmHg" in fields["systolic_bp"]["description"]


@pytest.mark.parametrize("document_type,id_field,date_field", [
    ("health_checkup", "health_checkup_id", "checkup_date"),
    ("body_composition", "body_composition_id", "measured_at"),
])
def test_mock_ocr_upload_review_update_confirm_flow(monkeypatch, document_type, id_field, date_field):
    """Real route/service flow; only external Storage/PostgREST are in memory."""
    monkeypatch.delenv("HEALTH_DOCUMENT_OCR_URL", raising=False)
    monkeypatch.delenv("HEALTH_DOCUMENT_OCR_MOCK_ENABLED", raising=False)
    rows = {"upload_files": [], "ocr_results": [], "health_checkups": [], "body_compositions": []}
    uploads = []

    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, *, headers, params=None, json=None, content=None):
            if "/storage/v1/object/" in url:
                uploads.append(content)
                return httpx.Response(200, json={})
            table = url.rsplit("/", 1)[-1]
            record = dict(json)
            if table == "upload_files": record["uploaded_at"] = "2026-09-17T00:00:00Z"
            rows[table].append(record)
            return httpx.Response(201, json=[record])
        async def get(self, url, *, headers, params):
            table = url.rsplit("/", 1)[-1]
            matches = [r for r in rows[table] if all(
                r.get(k) == v[3:] for k,v in params.items() if v.startswith("eq."))]
            return httpx.Response(200, json=matches)
        async def patch(self, url, *, headers, params, json):
            table = url.rsplit("/", 1)[-1]
            matches = [r for r in rows[table] if all(
                r.get(k) == v[3:] for k,v in params.items() if v.startswith("eq."))]
            for record in matches: record.update(json)
            return httpx.Response(200, json=matches)

    # TestClient's own HTTP transport is unchanged; only backend external calls use this fake.
    monkeypatch.setattr(health_documents.httpx, "AsyncClient", Client)
    override_dependencies()
    try:
        client = TestClient(main.app)
        upload = client.post("/api/health-documents", data={"document_type": document_type},
            files={"file": ("sample.pdf", b"%PDF-1.7\n", "application/pdf")})
        assert upload.status_code == 201
        initial = upload.json()
        assert initial["ocr_status"] == "completed"
        assert initial["error"] is None
        assert initial["extracted_data"][date_field] is not None
        assert initial["extracted_data"]["weight_kg"] == "70"
        assert len(uploads) == 1
        path = "/api/health-documents/" + initial["uploaded_file_id"]
        fetched = client.get(path)
        assert fetched.status_code == 200
        assert fetched.json()["extracted_data"] == initial["extracted_data"]
        patch = client.patch(path + "/ocr-result", json={"extracted_data": {"weight_kg": "69.5"}})
        assert patch.status_code == 200
        assert patch.json()["extracted_data"]["weight_kg"] == "69.5"
        assert patch.json()["extracted_data"][date_field] == initial["extracted_data"][date_field]
        confirmed = client.post(path + "/confirm")
        assert confirmed.status_code == 200
        assert confirmed.json()["status"] == "confirmed"
        assert confirmed.json()[id_field]
        assert confirmed.json()["health_data"]["weight_kg"] == "69.5"
        assert client.get(path).json()["status"] == "confirmed"
        repeated = client.post(path + "/confirm")
        assert repeated.status_code == 200
        assert repeated.json()[id_field] == confirmed.json()[id_field]
        assert repeated.json()["already_confirmed"] is True
        forbidden = client.patch(path + "/ocr-result", json={"extracted_data": {"weight_kg": "68"}})
        assert forbidden.status_code == 409
        assert forbidden.json()["detail"]["code"] == "DOCUMENT_CONFIRMED"
    finally:
        main.app.dependency_overrides.clear()
