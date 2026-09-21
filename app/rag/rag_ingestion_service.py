import hashlib

from app.rag.document_schema import (
    RAGDocument,
)

from app.rag.source_policy import (
    is_allowed_source,
)

from app.rag.vector_store import (
    rag_vector_store,
)


class RAGIngestionService:

    def validate_document(
        self,
        document: RAGDocument,
    ) -> bool:
        """
        문서가 허용된 공식/검증 출처인지 검사한다.
        """

        return is_allowed_source(
            source_org=document.metadata.source_org,
            document_type=document.metadata.document_type,
            verified=document.metadata.verified,
        )

    def chunk_document(
        self,
        document: RAGDocument,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
    ) -> list[dict]:
        """
        검증된 문서를 일정 길이로 분할한다.
        """

        if not self.validate_document(document):
            raise ValueError(
                "허용되지 않은 RAG 문서 출처입니다."
            )

        text = document.content.strip()

        if not text:
            raise ValueError(
                "RAG 문서 내용이 비어 있습니다."
            )

        if chunk_size <= 0:
            raise ValueError(
                "chunk_size는 1 이상이어야 합니다."
            )

        if chunk_overlap < 0:
            raise ValueError(
                "chunk_overlap은 0 이상이어야 합니다."
            )

        if chunk_overlap >= chunk_size:
            raise ValueError(
                "chunk_overlap은 chunk_size보다 작아야 합니다."
            )

        chunks: list[dict] = []

        start = 0
        chunk_index = 0

        while start < len(text):
            end = min(
                start + chunk_size,
                len(text),
            )

            chunk_text = text[
                start:end
            ].strip()

            if chunk_text:
                chunks.append(
                    {
                        "content": chunk_text,
                        "metadata": {
                            **document.metadata.model_dump(),
                            "chunk_index": chunk_index,
                        },
                    }
                )

            if end >= len(text):
                break

            start = end - chunk_overlap
            chunk_index += 1

        return chunks

    def prepare_document(
        self,
        document: RAGDocument,
    ) -> list[dict]:
        """
        문서를 검증하고 Vector DB 저장 직전 형태로 변환한다.
        """

        if not self.validate_document(document):
            raise ValueError(
                "RAG 정책에 허용되지 않은 문서입니다."
            )

        return self.chunk_document(
            document
        )

    def _build_chunk_id(
        self,
        content: str,
        metadata: dict,
    ) -> str:
        """
        문서의 출처 + 제목 + chunk index + 내용을 기준으로
        중복 방지를 위한 고유 chunk ID를 생성한다.
        """

        unique_source = (
            f"{metadata.get('source_org', '')}|"
            f"{metadata.get('title', '')}|"
            f"{metadata.get('chunk_index', '')}|"
            f"{content}"
        )

        return hashlib.sha256(
            unique_source.encode("utf-8")
        ).hexdigest()

    def ingest_document(
        self,
        document: RAGDocument,
    ) -> int:
        """
        검증된 공식 문서를 chunking 후
        Embedding 및 Chroma Vector DB에 저장한다.

        반환값:
        저장된 chunk 개수
        """

        chunks = self.prepare_document(
            document
        )

        stored_count = 0

        for chunk in chunks:
            content = chunk["content"]
            metadata = chunk["metadata"]

            chunk_id = self._build_chunk_id(
                content=content,
                metadata=metadata,
            )

            rag_vector_store.add_chunk(
                chunk_id=chunk_id,
                content=content,
                metadata=metadata,
            )

            stored_count += 1

        return stored_count


rag_ingestion_service = RAGIngestionService()