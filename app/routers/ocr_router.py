from fastapi import APIRouter, File, UploadFile
from app.schemas.ocr import OCRResponse
from app.services.ocr_service import ocr_service

router = APIRouter(prefix="/ai/ocr", tags=["ocr-kie"])


@router.post("", response_model=OCRResponse)
async def analyze_document(file: UploadFile = File(...)):
    result = await ocr_service.analyze(file)
    return OCRResponse(status="success", **result)
