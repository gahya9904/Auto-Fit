from fastapi import FastAPI
from app.routers.chat_router import router as chat_router
from app.routers.body_router import router as body_router
from app.routers.ocr_router import router as ocr_router
from app.routers.food_router import router as food_router
from app.routers.health_router import router as health_router

app = FastAPI(
    title="Healthcare AI Server",
    version="0.1.0",
    description="AI microservice for chatbot, body analysis, OCR/KIE, and food analysis",
)

app.include_router(health_router)
app.include_router(chat_router)
app.include_router(body_router)
app.include_router(ocr_router)
app.include_router(food_router)

@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Auto-Fit AI Server"
    }