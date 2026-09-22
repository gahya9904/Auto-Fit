from langgraph.graph import (
    StateGraph,
    START,
    END,
)

from app.graphs.state import AnalysisGraphState

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


def build_analysis_graph():
    graph = StateGraph(
        AnalysisGraphState
    )

    # --------------------------------------------------
    # Node 등록
    # --------------------------------------------------

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

    # --------------------------------------------------
    # Edge 연결
    # --------------------------------------------------

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

    return graph.compile()


analysis_graph = build_analysis_graph()