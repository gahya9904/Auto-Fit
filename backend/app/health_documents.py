from __future__ import annotations

from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Annotated, Any, Callable, Literal
from uuid import UUID, uuid4

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


HEALTH_DOCUMENT_BUCKET = "health-documents"
MAX_HEALTH_DOCUMENT_BYTES = 10 * 1024 * 1024
DocumentType = Literal["health_checkup", "body_composition"]


class HealthCheckupData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    checkup_date: date | None = None
    height_cm: Decimal | None = Field(default=None, ge=50, le=300)
    weight_kg: Decimal | None = Field(default=None, ge=1, le=500)
    bmi: Decimal | None = Field(default=None, ge=1, le=100)
    systolic_bp: int | None = Field(default=None, ge=30, le=300)
    diastolic_bp: int | None = Field(default=None, ge=20, le=200)
    fasting_glucose: Decimal | None = Field(default=None, ge=0, le=2000)
    total_cholesterol: Decimal | None = Field(default=None, ge=0, le=2000)
    hdl_cholesterol: Decimal | None = Field(default=None, ge=0, le=1000)
    ldl_cholesterol: Decimal | None = Field(default=None, ge=0, le=2000)
    triglycerides: Decimal | None = Field(default=None, ge=0, le=5000)
    ast: Decimal | None = Field(default=None, ge=0, le=10000)
    alt: Decimal | None = Field(default=None, ge=0, le=10000)
    gamma_gtp: Decimal | None = Field(default=None, ge=0, le=10000)
    hemoglobin: Decimal | None = Field(default=None, ge=0, le=100)
    creatinine: Decimal | None = Field(default=None, ge=0, le=100)
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

    measured_at: datetime | None = None
    height_cm: Decimal | None = Field(default=None, ge=50, le=300)
    weight_kg: Decimal | None = Field(default=None, ge=1, le=500)
    skeletal_muscle_mass_kg: Decimal | None = Field(default=None, ge=0, le=300)
    body_fat_mass_kg: Decimal | None = Field(default=None, ge=0, le=300)
    body_fat_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    bmi: Decimal | None = Field(default=None, ge=1, le=100)
    basal_metabolic_rate: Decimal | None = Field(default=None, ge=0, le=10000)
    visceral_fat_level: Decimal | None = Field(default=None, ge=0, le=100)
    body_water_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    body_water_liters: Decimal | None = Field(default=None, ge=0, le=300)
    protein_percentage: Decimal | None = Field(default=None, ge=0, le=100)
    device_name: str | None = Field(default=None, max_length=200)

    @field_validator("device_name", mode="before")
    @classmethod
    def normalize_device_name(cls, value: Any) -> Any:
        if not isinstance(value, str):
            return value
        return value.strip() or None


class OCRResultUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    extracted_data: dict[str, Any]

    @field_validator("extracted_data")
    @classmethod
    def limit_fields(cls, value: dict[str, Any]) -> dict[str, Any]:
        if len(value) > 30:
            raise ValueError("extracted_data has too many fields")
        return value


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
        "processing_type": "manual_review",
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

    ocr_payload = {
        "ocr_result_id": str(uuid4()),
        "uploaded_file_id": str(uploaded_file_id),
        "status": "completed",
        "raw_text": None,
        "extracted_data": _empty_extracted_data(document_type),
        "started_at": now.isoformat(),
        "completed_at": now.isoformat(),
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
            json={"extracted_data": validated},
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
    if ocr_result is None:
        raise HTTPException(status_code=409, detail="OCR review data is missing")
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


def create_health_documents_router(
    *,
    current_user_dependency: Callable[..., Any],
    settings_dependency: Callable[..., Any],
) -> APIRouter:
    router = APIRouter(prefix="/api/health-documents", tags=["health-documents"])

    @router.post("", status_code=status.HTTP_201_CREATED)
    async def upload_health_document(
        file: Annotated[UploadFile, File(description="PDF, PNG, JPEG, or HEIC; max 10 MB")],
        document_type: Annotated[DocumentType, Form()],
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        return await _create_document(
            file=file,
            document_type=document_type,
            user_id=user.id,
            settings=settings,
        )

    @router.get("/{uploaded_file_id}")
    async def get_health_document(
        uploaded_file_id: UUID,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        return await _fetch_document(uploaded_file_id, user.id, settings)

    @router.patch("/{uploaded_file_id}/ocr-result")
    async def update_health_document_result(
        uploaded_file_id: UUID,
        body: OCRResultUpdateRequest,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        return await _update_ocr_result(
            uploaded_file_id,
            body.extracted_data,
            user.id,
            settings,
        )

    @router.post("/{uploaded_file_id}/confirm")
    async def confirm_health_document(
        uploaded_file_id: UUID,
        user: Any = Depends(current_user_dependency),
        settings: Any = Depends(settings_dependency),
    ) -> dict[str, Any]:
        return await _confirm_document(uploaded_file_id, user.id, settings)

    return router
