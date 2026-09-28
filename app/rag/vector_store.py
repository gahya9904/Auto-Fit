from pathlib import Path
from typing import Any

import chromadb

from app.rag.embedding_service import (
    get_embedding_service,
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
        """
        문서 chunk를 embedding한 뒤
        Chroma에 저장한다.
        """

        embedding_service = get_embedding_service()

        embedding = embedding_service.embed_text(
            content
        )

        # Chroma metadata는
        # str / int / float / bool 타입만 허용
        safe_metadata = {
            key: value
            for key, value in metadata.items()
            if value is not None
            and isinstance(
                value,
                (
                    str,
                    int,
                    float,
                    bool,
                ),
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
        query_embedding,
        n_results=5,
        topic=None,
    ):
        where = None

        if topic:
            where = {
                "topic": topic
            }

        query_kwargs = {
            "query_embeddings": [
                query_embedding
            ],
            "n_results": n_results,
        }

        if where is not None:
            query_kwargs["where"] = where

        result = self.collection.query(
            **query_kwargs
        )

        return result


    def add_chunks(
        self,
        chunks: list[dict[str, Any]],
    ) -> None:
        """
        여러 chunk를 batch embedding 후
        Chroma에 한 번에 저장한다.
        """

        if not chunks:
            return

        embedding_service = get_embedding_service()

        contents = [
            chunk["content"]
            for chunk in chunks
        ]

        embeddings = embedding_service.embed_texts(
            contents
        )

        ids: list[str] = []
        documents: list[str] = []
        metadatas: list[dict[str, Any]] = []

        for chunk in chunks:
            ids.append(
                chunk["chunk_id"]
            )

            documents.append(
                chunk["content"]
            )

            metadata = chunk["metadata"]

            safe_metadata = {
                key: value
                for key, value in metadata.items()
                if value is not None
                and isinstance(
                    value,
                    (
                        str,
                        int,
                        float,
                        bool,
                    ),
                )
            }

            metadatas.append(
                safe_metadata
            )

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        
rag_vector_store = RAGVectorStore()