from openai import OpenAI

from app.core.config import get_settings


class EmbeddingService:

    def __init__(self):
        settings = get_settings()

        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured."
            )

        self.client = OpenAI(
            api_key=settings.openai_api_key
        )

        self.model = "text-embedding-3-small"

    def embed_text(
        self,
        text: str,
    ) -> list[float]:

        if not text.strip():
            raise ValueError(
                "Embedding text is empty."
            )

        response = self.client.embeddings.create(
            model=self.model,
            input=text,
        )

        return response.data[0].embedding


embedding_service = EmbeddingService()