from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any, Callable, Literal
import os
from uuid import UUID, uuid4

import httpx
from fastapi.routing import APIRoute
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


HEALTH_DOCUMENT_BUCKET = "health-documents"
MAX_HEALTH_DOCUMENT_BYTES = 10 * 1024 * 1024
DocumentType = Literal["health_checkup", "body_composition"]


class HealthCheckupData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkup_date: date | None = Field(default=None, description="검진일 YYYY-MM-DD. 확정 시 필수")
    height_cm: Decimal | None = Field(default=None, ge=50, le=300, description="단위: cm. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    weight_kg: Decimal | None = Field(default=None, ge=1, le=500, description="단위: kg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    bmi: Decimal | None = Field(default=None, ge=1, le=100, description="단위: kg/m². Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    systolic_bp: int | None = Field(default=None, ge=30, le=300, description="단위: mmHg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    diastolic_bp: int | None = Field(default=None, ge=20, le=200, description="단위: mmHg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    fasting_glucose: Decimal | None = Field(default=None, ge=0, le=2000, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    total_cholesterol: Decimal | None = Field(default=None, ge=0, le=2000, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    hdl_cholesterol: Decimal | None = Field(default=None, ge=0, le=1000, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    ldl_cholesterol: Decimal | None = Field(default=None, ge=0, le=2000, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    triglycerides: Decimal | None = Field(default=None, ge=0, le=5000, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    ast: Decimal | None = Field(default=None, ge=0, le=10000, description="단위: U/L. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    alt: Decimal | None = Field(default=None, ge=0, le=10000, description="단위: U/L. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    gamma_gtp: Decimal | None = Field(default=None, ge=0, le=10000, description="단위: U/L. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    hemoglobin: Decimal | None = Field(default=None, ge=0, le=100, description="단위: g/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    creatinine: Decimal | None = Field(default=None, ge=0, le=100, description="단위: mg/dL. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    institution_name: str | None = Field(default=None, max_length=200)
    checkup_type: str | None = Field(default=None, max_length=100)

    @field_validator("institution_name", "checkup_type", mode="before")
    @classmethod
    def normalize_text(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        return value.strip() or None


class BodyCompositionData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    measured_at: datetime | None = Field(default=None, description="측정 시각 ISO 8601. 시간대 포함 권장. 확정 시 필수")
    height_cm: Decimal | None = Field(default=None, ge=50, le=300, description="단위: cm. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    weight_kg: Decimal | None = Field(default=None, ge=1, le=500, description="단위: kg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    skeletal_muscle_mass_kg: Decimal | None = Field(default=None, ge=0, le=300, description="단위: kg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    body_fat_mass_kg: Decimal | None = Field(default=None, ge=0, le=300, description="단위: kg. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    body_fat_percentage: Decimal | None = Field(default=None, ge=0, le=100, description="단위: %. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    bmi: Decimal | None = Field(default=None, ge=1, le=100, description="단위: kg/m². Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    basal_metabolic_rate: Decimal | None = Field(default=None, ge=0, le=10000, description="단위: kcal/day. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    visceral_fat_level: Decimal | None = Field(default=None, ge=0, le=100, description="단위: level. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    body_water_percentage: Decimal | None = Field(default=None, ge=0, le=100, description="단위: %. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    body_water_liters: Decimal | None = Field(default=None, ge=0, le=300, description="단위: L. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    protein_percentage: Decimal | None = Field(default=None, ge=0, le=100, description="단위: %. Decimal 값은 응답에서 문자열로 직렬화됩니다.")
    device_name: str | None = Field(default=None, max_length=200)

    @field_validator("device_name", mode="before")
    @classmethod
    def normalize_device_name(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        return value.strip() or None


class OCRResultUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_data: HealthCheckupData | BodyCompositionData = Field(
        description="문서 종류에 맞는 필드만 허용. 보낸 필드만 갱신; null은 해당 값을 비웁니다."
    )


class DocumentErrorDetail(BaseModel):
    code: str
    message: str
    fields: list[str] | None = None


class DocumentError(BaseModel):
    detail: DocumentErrorDetail


class UploadMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")
    uploaded_file_id: UUID
    document_type: DocumentType


class OCRMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")
    status: Literal["pending", "processing", "completed", "failed"]


class DocumentResponseBase(BaseModel):
    uploaded_file_id: UUID
    file_name: str
    uploaded_at: datetime
    ocr_status: Literal["pending", "processing", "completed", "failed"]
    status: Literal["awaiting_review", "confirmed", "failed"]
    error: DocumentErrorDetail | None = None
    file: UploadMetadata = Field(description="기존 클라이언트 호환용 파일 메타데이터")
    ocr_result: OCRMetadata | None = None


class HealthCheckupDocumentResponse(DocumentResponseBase):
    document_type: Literal["health_checkup"]
    extracted_data: HealthCheckupData


class BodyCompositionDocumentResponse(DocumentResponseBase):
    document_type: Literal["body_composition"]
    extracted_data: BodyCompositionData


DocumentResponse = Annotated[
    HealthCheckupDocumentResponse | BodyCompositionDocumentResponse,
    Field(discriminator="document_type"),
]


class ConfirmationResponse(BaseModel):
    uploaded_file_id: UUID
    document_type: DocumentType
    status: Literal["confirmed"]
    health_checkup_id: UUID | None = None
    body_composition_id: UUID | None = None
    already_confirmed: bool
    file: UploadMetadata
    health_data: dict[str, Any] = Field(description="저장된 DB 레코드; 생성 ID는 최상위 필드 사용")


DOCUMENT_ERRORS = {
    code: {"model": DocumentError, "description": description}
    for code, description in {
        401: "AUTH_REQUIRED: 인증 실패 또는 세션 만료",
        404: "DOCUMENT_NOT_FOUND: 문서 없음 또는 다른 사용자 소유",
        409: "DOCUMENT_CONFIRMED / OCR_NOT_READY: 확정 문서 수정 또는 OCR 미완료",
        413: "FILE_TOO_LARGE: 최대 10 MiB",
        415: "UNSUPPORTED_FILE_TYPE: PDF/PNG/JPEG/HEIC만 허용",
        422: "VALIDATION_ERROR: 종류별 필드/값 오류 또는 확정 필수 날짜 누락",
        502: "DATA_SOURCE_ERROR: 저장소/DB 호출 실패",
    }.items()
}


def _document_response(document: dict[str, Any]) -> dict[str, Any]:
    file = document["file"]
    ocr = document["ocr_result"]
    ocr_status = ocr["status"] if ocr else "pending"
    return {
        **document,
        "uploaded_file_id": file["uploaded_file_id"],
        "document_type": file["document_type"],
        "file_name": file["file_name"],
        "uploaded_at": file["uploaded_at"],
        "ocr_status": ocr_status,
        "status": "confirmed" if file.get("processing_status") == "manually_confirmed" else (
            "failed" if ocr_status == "failed" else "awaiting_review"
        ),
        "extracted_data": (ocr or {}).get("extracted_data") or _empty_extracted_data(file["document_type"]),
        "error": {"code": (ocr or {}).get("error_message") or "OCR_FAILED",
                  "message": "OCR 결과를 추출하지 못했습니다. 다시 업로드하거나 직접 입력해 주세요.",
                  "fields": None} if ocr_status == "failed" else None,
    }


async def _extract_document(content: bytes, media_type: str, document_type: DocumentType) -> tuple[dict[str, Any], str | None]:
    """Trusted configured OCR adapter; never forward Supabase/user credentials."""
    endpoint = os.getenv("HEALTH_DOCUMENT_OCR_URL", "")
    if not endpoint:
        if os.getenv("HEALTH_DOCUMENT_OCR_MOCK_ENABLED", "true").lower() == "true":
            return _mock_extracted_data(document_type), None
        return _empty_extracted_data(document_type), "OCR_NOT_CONFIGURED"
    headers = {}
    token = os.getenv("HEALTH_DOCUMENT_OCR_TOKEN", "")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        async with httpx.AsyncClient(timeout=60, trust_env=False) as client:
            response = await client.post(endpoint, headers=headers,
                files={"file": ("document", content, media_type)},
                data={"document_type": document_type})
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            return _empty_extracted_data(document_type), "EXTRACTION_FAILED"
        if result.get("document_type") != document_type:
            return _empty_extracted_data(document_type), "DOCUMENT_TYPE_MISMATCH"
        validated = _validate_extracted_data(document_type, result["extracted_data"], require_measurement_date=False)
        if not any(value is not None for value in validated.values()):
            return validated, "EXTRACTION_FAILED"
        return validated, None
    except HTTPException:
        return _empty_extracted_data(document_type), "EXTRACTION_FAILED"
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        return _empty_extracted_data(document_type), "OCR_FAILED"


def _mock_extracted_data(document_type: DocumentType) -> dict[str, Any]:
    """Fixed integration fixtures, independent of uploaded contents."""
    common = {"height_cm": "175", "weight_kg": "70", "bmi": "22.9"}
    if document_type == "health_checkup":
        model = HealthCheckupData(**common, checkup_date="2026-09-17",
            systolic_bp=120, diastolic_bp=80, fasting_glucose="92",
            total_cholesterol="180", hdl_cholesterol="55", ldl_cholesterol="105",
            triglycerides="100", ast="22", alt="20", gamma_gtp="25",
            hemoglobin="14.5", creatinine="0.9", institution_name="테스트 검진기관",
            checkup_type="일반건강검진")
    else:
        model = BodyCompositionData(**common, measured_at="2026-09-17T09:00:00+09:00",
            skeletal_muscle_mass_kg="31", body_fat_mass_kg="14",
            body_fat_percentage="20", basal_metabolic_rate="1580",
            visceral_fat_level="5", body_water_percentage="57",
            body_water_liters="39.9", protein_percentage="16", device_name="테스트 InBody")
    return model.model_dump(mode="json")


def _service_headers(settings: Any, *, return_representation: bool = False) -> dict[str, str]:
    key = settings.supabase_service_role_key
    headers = {"apikey": key}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = f"Bearer {key}"
    if return_representation:
        headers["Prefer"] = "return=representation"
    return headers


def _clean_filename(filename: str | None) -> str:
    cleaned = (filename or "health-document").replace("\x00", "")
    cleaned = cleaned.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].strip()
    return (cleaned or "health-document")[:255]


def _detect_media_type(content: bytes) -> tuple[str, str] | None:
    if content.startswith(b"%PDF-"):
        return "application/pdf", ".pdf"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", ".png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", ".jpg"
    if len(content) >= 12 and content[4:8] == b"ftyp" and content[8:12] in {
        b"heic",
        b"heix",
        b"mif1",
        b"msf1",
    }:
        return "image/heic", ".heic"
    return None


async def _read_validated_upload(file: UploadFile) -> tuple[bytes, str, str]:
    content = bytearray()
    while chunk := await file.read(1024 * 1024):
        content.extend(chunk)
        if len(content) > MAX_HEALTH_DOCUMENT_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Health document must be 10 MB or smaller",
            )
    detected = _detect_media_type(bytes(content))
    if detected is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF, PNG, JPEG, and HEIC health documents are supported",
        )
    return bytes(content), *detected


def _empty_extracted_data(document_type: DocumentType) -> dict[str, Any]:
    model = HealthCheckupData if document_type == "health_checkup" else BodyCompositionData
    return model().model_dump(mode="json")


def _validate_extracted_data(
    document_type: DocumentType,
    data: dict[str, Any],
    *,
    require_measurement_date: bool,
) -> dict[str, Any]:
    model = HealthCheckupData if document_type == "health_checkup" else BodyCompositionData
    try:
        validated = model.model_validate(data)
    except ValidationError as exc:
        fields = ["extracted_data." + ".".join(map(str, error["loc"])) for error in exc.errors()]
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": "Invalid health document data", "fields": fields},
        ) from exc
    if require_measurement_date:
        required_field = "checkup_date" if document_type == "health_checkup" else "measured_at"
        if getattr(validated, required_field) is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": f"{required_field} is required before confirmation",
                    "fields": [f"extracted_data.{required_field}"],
                },
            )
    return validated.model_dump(mode="json")


async def _fetch_document(
    uploaded_file_id: UUID,
    user_id: str,
    settings: Any,
) -> dict[str, Any]:
    headers = _service_headers(settings)
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        upload_response = await client.get(
            f"{settings.supabase_url}/rest/v1/upload_files",
            headers=headers,
            params={
                "select": (
                    "uploaded_file_id,file_name,original_file_name,storage_path,mime_type,"
                    "file_size,document_type,upload_status,processing_status,uploaded_at"
                ),
                "uploaded_file_id": f"eq.{uploaded_file_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        if not upload_response.is_success:
            raise HTTPException(status_code=502, detail="Supabase upload query failed")
        uploads = upload_response.json()
        if not uploads:
            raise HTTPException(status_code=404, detail="Health document was not found")
        ocr_response = await client.get(
            f"{settings.supabase_url}/rest/v1/ocr_results",
            headers=headers,
            params={
                "select": "ocr_result_id,status,extracted_data,error_message,created_at,completed_at",
                "uploaded_file_id": f"eq.{uploaded_file_id}",
                "limit": "1",
            },
        )
    if not ocr_response.is_success:
        raise HTTPException(status_code=502, detail="Supabase OCR result query failed")
    ocr_rows = ocr_response.json()
    return {"file": uploads[0], "ocr_result": ocr_rows[0] if ocr_rows else None}


async def _delete_storage_object(storage_path: str, settings: Any) -> None:
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        await client.delete(
            f"{settings.supabase_url}/storage/v1/object/{HEALTH_DOCUMENT_BUCKET}/{storage_path}",
            headers=_service_headers(settings),
        )


async def _delete_upload_row(uploaded_file_id: UUID, settings: Any) -> None:
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        await client.delete(
            f"{settings.supabase_url}/rest/v1/upload_files",
            headers=_service_headers(settings),
            params={"uploaded_file_id": f"eq.{uploaded_file_id}"},
        )


async def _create_document(
    *,
    file: UploadFile,
    document_type: DocumentType,
    user_id: str,
    settings: Any,
) -> dict[str, Any]:
    content, media_type, extension = await _read_validated_upload(file)
    uploaded_file_id = uuid4()
    now = datetime.now(UTC)
    storage_path = f"{user_id}/{now:%Y/%m}/{uploaded_file_id}{extension}"
    filename = _clean_filename(file.filename)
    storage_headers = _service_headers(settings)
    storage_headers.update({"Content-Type": media_type, "x-upsert": "false"})

    async with httpx.AsyncClient(timeout=30, trust_env=False) as client:
        storage_response = await client.post(
            f"{settings.supabase_url}/storage/v1/object/{HEALTH_DOCUMENT_BUCKET}/{storage_path}",
            headers=storage_headers,
            content=content,
        )
    if not storage_response.is_success:
        raise HTTPException(status_code=502, detail="Health document storage upload failed")

    upload_payload = {
        "uploaded_file_id": str(uploaded_file_id),
        "user_id": user_id,
        "file_name": filename,
        "original_file_name": filename,
        "storage_path": storage_path,
        "file_type": extension.removeprefix("."),
        "mime_type": media_type,
        "file_size": len(content),
        "document_type": document_type,
        "upload_status": "processing",
        "source_type": "file",
        "processing_type": "ocr",
        "processing_status": "awaiting_review",
    }
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        upload_response = await client.post(
            f"{settings.supabase_url}/rest/v1/upload_files",
            headers=_service_headers(settings, return_representation=True),
            params={"select": "*"},
            json=upload_payload,
        )
    if not upload_response.is_success:
        await _delete_storage_object(storage_path, settings)
        raise HTTPException(status_code=502, detail="Health document metadata creation failed")

    extracted_data, ocr_error = await _extract_document(content, media_type, document_type)
    ocr_payload = {
        "ocr_result_id": str(uuid4()),
        "uploaded_file_id": str(uploaded_file_id),
        "status": "failed" if ocr_error else "completed",
        "error_message": ocr_error,
        "raw_text": None,
        "extracted_data": extracted_data,
        "started_at": now.isoformat(),
        "completed_at": datetime.now(UTC).isoformat(),
    }
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        ocr_response = await client.post(
            f"{settings.supabase_url}/rest/v1/ocr_results",
            headers=_service_headers(settings, return_representation=True),
            params={"select": "*"},
            json=ocr_payload,
        )
    if not ocr_response.is_success:
        await _delete_upload_row(uploaded_file_id, settings)
        await _delete_storage_object(storage_path, settings)
        raise HTTPException(status_code=502, detail="Temporary OCR result creation failed")
    return await _fetch_document(uploaded_file_id, user_id, settings)


async def _update_ocr_result(
    uploaded_file_id: UUID,
    extracted_data: dict[str, Any],
    user_id: str,
    settings: Any,
) -> dict[str, Any]:
    document = await _fetch_document(uploaded_file_id, user_id, settings)
    document_type = document["file"]["document_type"]
    table = "health_checkups" if document_type == "health_checkup" else "body_compositions"
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        existing = await client.get(f"{settings.supabase_url}/rest/v1/{table}",
            headers=_service_headers(settings), params={"select": "uploaded_file_id",
            "uploaded_file_id": f"eq.{uploaded_file_id}", "user_id": f"eq.{user_id}", "limit": "1"})
    if not existing.is_success:
        raise HTTPException(status_code=502, detail="Health data lookup failed")
    if existing.json() or document["file"].get("processing_status") == "manually_confirmed":
        raise HTTPException(status_code=409, detail={"code": "DOCUMENT_CONFIRMED", "message": "Confirmed documents cannot be edited", "fields": None})
    ocr = document["ocr_result"]
    if not ocr or ocr["status"] in {"pending", "processing"}:
        raise HTTPException(status_code=409, detail={"code": "OCR_NOT_READY", "message": "OCR is not ready for review", "fields": None})
    extracted_data = {**(ocr.get("extracted_data") or {}), **extracted_data}
    validated = _validate_extracted_data(
        document_type,
        extracted_data,
        require_measurement_date=False,
    )
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        response = await client.patch(
            f"{settings.supabase_url}/rest/v1/ocr_results",
            headers=_service_headers(settings, return_representation=True),
            params={"uploaded_file_id": f"eq.{uploaded_file_id}", "select": "ocr_result_id"},
            json={"extracted_data": validated, "status": "completed", "error_message": None},
        )
    if not response.is_success or not response.json():
        raise HTTPException(status_code=502, detail="Temporary OCR result update failed")
    return await _fetch_document(uploaded_file_id, user_id, settings)


async def _confirm_document(
    uploaded_file_id: UUID,
    user_id: str,
    settings: Any,
) -> dict[str, Any]:
    document = await _fetch_document(uploaded_file_id, user_id, settings)
    file_record = document["file"]
    ocr_result = document["ocr_result"]
    if ocr_result is None or ocr_result["status"] != "completed":
        raise HTTPException(status_code=409, detail={"code": "OCR_NOT_READY", "message": "OCR must be completed or manually corrected", "fields": None})
    document_type: DocumentType = file_record["document_type"]
    validated = _validate_extracted_data(
        document_type,
        ocr_result.get("extracted_data") or {},
        require_measurement_date=True,
    )
    table = "health_checkups" if document_type == "health_checkup" else "body_compositions"
    id_field = "health_checkup_id" if document_type == "health_checkup" else "body_composition_id"
    headers = _service_headers(settings)
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        existing_response = await client.get(
            f"{settings.supabase_url}/rest/v1/{table}",
            headers=headers,
            params={
                "select": "*",
                "uploaded_file_id": f"eq.{uploaded_file_id}",
                "user_id": f"eq.{user_id}",
                "limit": "1",
            },
        )
    if not existing_response.is_success:
        raise HTTPException(status_code=502, detail="Health data lookup failed")
    existing = existing_response.json()
    if existing:
        return {"file": file_record, "health_data": existing[0], "already_confirmed": True}

    payload = {
        id_field: str(uuid4()),
        "uploaded_file_id": str(uploaded_file_id),
        "user_id": user_id,
        "source_type": "manual",
        "raw_data": validated,
        **{key: value for key, value in validated.items() if value is not None},
    }
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        create_response = await client.post(
            f"{settings.supabase_url}/rest/v1/{table}",
            headers=_service_headers(settings, return_representation=True),
            params={"select": "*"},
            json=payload,
        )
    if not create_response.is_success or not create_response.json():
        raise HTTPException(status_code=502, detail="Confirmed health data creation failed")

    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        status_response = await client.patch(
            f"{settings.supabase_url}/rest/v1/upload_files",
            headers=_service_headers(settings, return_representation=True),
            params={
                "uploaded_file_id": f"eq.{uploaded_file_id}",
                "user_id": f"eq.{user_id}",
                "select": "uploaded_file_id,upload_status,processing_status",
            },
            json={"upload_status": "completed", "processing_status": "manually_confirmed"},
        )
    if not status_response.is_success:
        raise HTTPException(status_code=502, detail="Health document status update failed")
    return {
        "file": {**file_record, "upload_status": "completed", "processing_status": "manually_confirmed"},
        "health_data": create_response.json()[0],
        "already_confirmed": False,
    }


class HealthDocumentRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except httpx.RequestError as exc:
                raise HTTPException(status_code=502, detail="Health document data source unavailable") from exc
        return handler


def create_health_documents_router(
    *,
    current_user_dependency: Callable[..., Any],
    settings_dependency: Callable[..., Any],
) -> APIRouter:
    router = APIRouter(prefix="/api/health-documents", tags=["health-documents"], route_class=HealthDocumentRoute)

    @router.post("", status_code=status.HTTP_201_CREATED, response_model=DocumentResponse, responses=DOCUMENT_ERRORS, description="파일 1개당 호출. 저장 후 동기 OCR 실행. OCR URL 미설정 시 기본적으로 문서 종류별 고정 샘플을 completed로 반환; HEALTH_DOCUMENT_OCR_MOCK_ENABLED=false로 비활성화. 실패도 파일 ID와 ocr_status=failed 반환. 재업로드는 새 ID 생성; 이전 문서는 유지되고 confirm 전에는 분석 DB에 저장되지 않음.")
    async def upload_health_document(
        file: Annotated[UploadFile, File(description="PDF, PNG, JPEG, or HEIC; max 10 MB")],
        document_type: Annotated[DocumentType, Form()],
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        document = await _create_document(
            file=file,
            document_type=document_type,
            user_id=user.id,
            settings=settings,
        )
        return _document_response(document)

    @router.get("/{uploaded_file_id}", response_model=DocumentResponse, responses=DOCUMENT_ERRORS)
    async def get_health_document(
        uploaded_file_id: UUID,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        return _document_response(await _fetch_document(uploaded_file_id, user.id, settings))

    @router.patch("/{uploaded_file_id}/ocr-result", response_model=DocumentResponse, responses=DOCUMENT_ERRORS)
    async def update_health_document_result(
        uploaded_file_id: UUID,
        body: OCRResultUpdateRequest,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        document = await _update_ocr_result(
            uploaded_file_id,
            body.extracted_data.model_dump(mode="json", exclude_unset=True),
            user.id,
            settings,
        )
        return _document_response(document)

    @router.post("/{uploaded_file_id}/confirm", response_model=ConfirmationResponse, responses=DOCUMENT_ERRORS, description="검진은 health_checkups, 체성분은 body_compositions에 저장. 재호출은 기존 ID 반환. 날짜 필수.")
    async def confirm_health_document(
        uploaded_file_id: UUID,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        result = await _confirm_document(uploaded_file_id, user.id, settings)
        return {**result, "uploaded_file_id": uploaded_file_id,
                "document_type": result["file"]["document_type"], "status": "confirmed",
                "health_checkup_id": result["health_data"].get("health_checkup_id"),
                "body_composition_id": result["health_data"].get("body_composition_id")}

    return router
