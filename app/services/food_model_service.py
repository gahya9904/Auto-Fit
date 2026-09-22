from fastapi import UploadFile


class FoodModelService:
    async def predict(self, file: UploadFile) -> dict:
        # TODO: EfficientNet-B0 등 음식 분류 모델 연결
        content = await file.read()
        return {
            "food_name": None,
            "confidence": None,
            "estimated_calories_kcal": None,
            "message": f"음식 분류 모델 연결 전입니다. 수신 파일 크기: {len(content)} bytes",
        }


food_model_service = FoodModelService()
