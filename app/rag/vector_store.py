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
    query: str,
    n_results: int = 5,
    topic: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        query를 embedding하여 유사 문서를 검색한다.

        topic이 전달되면
        해당 health topic 문서만 검색한다.
        """

        if not query.strip():
            return []

        embedding_service = get_embedding_service()

        query_embedding = embedding_service.embed_text(
            query
        )

        query_kwargs: dict[str, Any] = {
            "query_embeddings": [
                query_embedding
            ],
            "n_results": n_results,
            "include": [
                "documents",
                "metadatas",
                "distances",
            ],
        }

        if topic:
            query_kwargs["where"] = {
                "topic": topic
            }

            result = self.collection.query(
                **query_kwargs
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

            results: list[
                dict[str, Any]
            ] = []

            for (
                document,
                metadata,
                distance,
            ) in zip(
                documents,
                metadatas,
                distances,
            ):
                metadata = metadata or {}

                results.append(
                    {
                        "content": document,
                        "source_org": metadata.get(
                            "source_org"
                        ),
                        "title": metadata.get(
                            "title"
                        ),
                        "document_type": metadata.get(
                            "document_type"
                        ),
                        "published_year": metadata.get(
                            "published_year"
                        ),
                        "url": metadata.get(
                            "url"
                        ),
                        "verified": metadata.get(
                            "verified",
                            False,
                        ),
                        "language": metadata.get(
                            "language"
                        ),
                        "topic": metadata.get(
                            "topic"
                        ),
                        "chunk_index": metadata.get(
                            "chunk_index"
                        ),
                        "distance": distance,
                    }
                )

            return results


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