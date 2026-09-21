from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.security import (
    HTTPAuthorizationCredentials,
)

from app.core.security import (
    security,
    verify_api_key,
)

from app.rag.document_schema import (
    RAGDocument,
    RAGDocumentMetadata,
)

from app.rag.rag_ingestion_service import (
    rag_ingestion_service,
)

from app.rag.vector_store import (
    rag_vector_store,
)


router = APIRouter(
    prefix="/rag",
    tags=["rag"],
)


@router.post("/test-ingest")
async def test_ingest(
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
):
    verify_api_key(credentials)

    try:
        document = RAGDocument(
            content=(
                "공복혈당이 정상보다 높은 경우에는 "
                "대사 건강 상태를 함께 확인할 필요가 있습니다. "
                "식사, 운동, 체중 관리와 같은 생활습관 요소를 "
                "함께 고려해야 합니다."
            ),
            metadata=RAGDocumentMetadata(
                source_org="대한당뇨병학회",
                title="당뇨병 관련 공식 테스트 문서",
                document_type="clinical_guideline",
                published_year=2025,
                url="https://example.com/test",
                verified=True,
                language="ko",
                topic="diabetes",
            ),
        )

        stored_count = (
            rag_ingestion_service.ingest_document(
                document
            )
        )

        return {
            "status": "ok",
            "stored_chunks": stored_count,
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="RAG ingestion failed",
        )


@router.get("/test-search")
async def test_search(
    query: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(
        security
    ),
):
    verify_api_key(credentials)

    try:
        results = rag_vector_store.search(
            query=query,
            n_results=3,
        )

        return {
            "query": query,
            "results": results,
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="RAG search failed",
        )