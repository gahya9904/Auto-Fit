from langgraph.graph import (
    END,
    START,
    StateGraph,
)

from app.graphs.state import (
    AnalysisState,
)

from app.graphs.nodes.rule_engine_node import (
    rule_engine_node,
)

from app.graphs.nodes.merge_node import (
    merge_node,
)

from app.graphs.nodes.rag_node import (
    rag_node,
)

from app.graphs.nodes.llm_node import (
    llm_node,
)


# =========================================================
# Graph Builder
# =========================================================


def build_analysis_graph():
    """
    Auto-Fit 건강 분석 LangGraph.

    실행 순서:

    START
      ↓
    Rule Engine
      ↓
    Merge
      ↓
    RAG
      ↓
    LLM
      ↓
    END
    """

    graph = StateGraph(
        AnalysisState
    )

    # =====================================================
    # Nodes
    # =====================================================

    graph.add_node(
        "rule_engine",
        rule_engine_node,
    )

    graph.add_node(
        "merge",
        merge_node,
    )

    graph.add_node(
        "rag",
        rag_node,
    )

    graph.add_node(
        "llm",
        llm_node,
    )

    # =====================================================
    # Edges
    # =====================================================

    graph.add_edge(
        START,
        "rule_engine",
    )

    graph.add_edge(
        "rule_engine",
        "merge",
    )

    graph.add_edge(
        "merge",
        "rag",
    )

    graph.add_edge(
        "rag",
        "llm",
    )

    graph.add_edge(
        "llm",
        END,
    )

    # =====================================================
    # Compile
    # =====================================================

    return graph.compile()


# =========================================================
# Application Graph
# =========================================================

analysis_graph = (
    build_analysis_graph()
)