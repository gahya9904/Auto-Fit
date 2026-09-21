from typing import Any

from app.graphs.state import AnalysisGraphState

from app.rag.source_policy import (
    is_allowed_source,
)

from app.rag.vector_store import (
    rag_vector_store,
)


def _build_rag_query(
    merged_analysis: dict[str, Any],
) -> str:
    """
    개인정보 없이 Rule Engine의 상태값만 이용해
    RAG 검색어를 생성한다.
    """

    metric_statuses = merged_analysis.get(
        "metric_statuses",
        {},
    )

    if not metric_statuses:
        return ""

    query_parts: list[str] = []

    for metric, status in metric_statuses.items():
        query_parts.append(
            f"{metric}: {status}"
        )

    query_parts.append(
        "관련 공식 건강관리 가이드라인 운동 식단 생활습관"
    )

    return " | ".join(query_parts)


def _is_verified_result(
    result: dict[str, Any],
) -> bool:
    """
    Vector DB 검색 결과가 현재 RAG 정책에
    허용되는 공식 자료인지 다시 검증한다.
    """

    metadata = result.get(
        "metadata",
        {},
    )

    if not isinstance(metadata, dict):
        return False

    source_org = metadata.get(
        "source_org"
    )

    document_type = metadata.get(
        "document_type"
    )

    verified = metadata.get(
        "verified",
        False,
    )

    if not source_org or not document_type:
        return False

    return is_allowed_source(
        source_org=str(source_org),
        document_type=str(document_type),
        verified=bool(verified),
    )


def rag_node(
    state: AnalysisGraphState,
) -> AnalysisGraphState:
    """
    merged_analysis를 기반으로
    검증된 공식 건강 문서를 검색한다.

    사용자 개인정보나 원본 문서는
    검색 query에 포함하지 않는다.
    """

    merged_analysis = state.get(
        "merged_analysis",
        {},
    )

    warnings = state.get(
        "warnings",
        [],
    ).copy()

    query = _build_rag_query(
        merged_analysis
    )

    if not query:
        warnings.append(
            "RAG 검색에 사용할 분석 결과가 부족합니다."
        )

        return {
            "rag_context": [],
            "warnings": warnings,
        }

    try:
        raw_results = rag_vector_store.search(
            query=query,
            n_results=5,
        )

    except Exception:
        warnings.append(
            "RAG 근거 검색을 수행하지 못했습니다."
        )

        return {
            "rag_context": [],
            "warnings": warnings,
        }

    # --------------------------------------------------
    # 검색 후에도 화이트리스트 재검증
    # --------------------------------------------------

    verified_results: list[dict[str, Any]] = []

    for result in raw_results:

        if not _is_verified_result(
            result
        ):
            continue

        metadata = result.get(
            "metadata",
            {},
        )

        verified_results.append(
            {
                "content": result.get(
                    "content",
                    "",
                ),
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
                "topic": metadata.get(
                    "topic"
                ),
                "distance": result.get(
                    "distance"
                ),
            }
        )

    if not verified_results:
        warnings.append(
            "검증된 공식 RAG 근거를 찾지 못했습니다."
        )

    return {
        "rag_context": verified_results,
        "warnings": warnings,
    }