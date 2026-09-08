from fastapi import APIRouter, File, UploadFile
from app.schemas.food import FoodAnalysisResponse
from app.services.food_model_service import food_model_service

router = APIRouter(prefix="/ai/food-analysis", tags=["food-analysis"])


@router.post("", response_model=FoodAnalysisResponse)
async def analyze_food(file: UploadFile = File(...)):
    result = await food_model_service.predict(file)
    return FoodAnalysisResponse(status="success", **result)
