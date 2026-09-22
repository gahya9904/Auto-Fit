from fastapi import UploadFile


class OCRService:
    async def analyze(self, file: UploadFile) -> dict:
        # TODO: PaddleOCR, EasyOCR, Donut, LayoutLM/KIE 등을 연결
        content = await file.read()
        return {
            "extracted_text": None,
            "fields": {},
            "message": f"OCR/KIE 모델 연결 전입니다. 수신 파일 크기: {len(content)} bytes",
        }


ocr_service = OCRService()
