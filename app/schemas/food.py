from pydantic import BaseModel


class FoodAnalysisResponse(BaseModel):
    status: str
    food_name: str | None = None
    confidence: float | None = None
    estimated_calories_kcal: float | None = None
    message: str | None = None
