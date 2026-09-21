from pathlib import Path
from typing import Any

import chromadb

from app.rag.embedding_service import (
    embedding_service,
)


class RAGVectorStore:

    def __init__(
        self,
        path: str | Path = "data/chroma",
        collection_name: str = "health_guidelines",
    ):
        self.path = str(path)

        self.client = chromadb.PersistentClient(
            path=self.path
        )

        self.collection = (
            self.client.get_or_create_collection(
                name=collection_name
            )
        )

    def add_chunk(
        self,
        chunk_id: str,
        content: str,
        metadata: dict[str, Any],
    ) -> None:

        embedding = embedding_service.embed_text(
            content
        )

        # Chroma metadata는 단순 타입으로 유지
        safe_metadata = {
            key: value
            for key, value in metadata.items()
            if value is not None
            and isinstance(
                value,
                (str, int, float, bool),
            )
        }

        self.collection.upsert(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[safe_metadata],
        )

    def search(
        self,
        query: str,
        n_results: int = 5,
    ) -> list[dict[str, Any]]:

        query_embedding = (
            embedding_service.embed_text(
                query
            )
        )

        result = self.collection.query(
            query_embeddings=[
                query_embedding
            ],
            n_results=n_results,
            include=[
                "documents",
                "metadatas",
                "distances",
            ],
        )

        documents = (
            result.get("documents")
            or [[]]
        )[0]

        metadatas = (
            result.get("metadatas")
            or [[]]
        )[0]

        distances = (
            result.get("distances")
            or [[]]
        )[0]

        results: list[dict[str, Any]] = []

        for document, metadata, distance in zip(
            documents,
            metadatas,
            distances,
        ):
            results.append(
                {
                    "content": document,
                    "metadata": metadata,
                    "distance": distance,
                }
            )

        return results


rag_vector_store = RAGVectorStore()