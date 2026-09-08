from pydantic import BaseModel


class OCRResponse(BaseModel):
    status: str
    extracted_text: str | None = None
    fields: dict | None = None
    message: str | None = None
