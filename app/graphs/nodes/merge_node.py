from typing import Any

from app.graphs.state import AnalysisGraphState


def _extract_statuses(
    analysis: dict[str, Any],
) -> dict[str, str]:

    statuses: dict[str, str] = {}

    for section_name in (
        "body_analysis",
        "health_analysis",
    ):
        section = analysis.get(
            section_name,
            {},
        )

        if not isinstance(section, dict):
            continue

        for metric_name, metric_result in section.items():
            if not isinstance(metric_result, dict):
                continue

            status = metric_result.get("status")

            if status is not None:
                statuses[metric_name] = str(status)

    return statuses


def merge_node(
    state: AnalysisGraphState,
) -> AnalysisGraphState:

    rule_result = state.get(
        "rule_engine_result",
        {},
    )

    warnings = state.get(
        "warnings",
        [],
    ).copy()

    metric_statuses = _extract_statuses(
        rule_result
    )

    merged_analysis = {
        "metric_statuses": metric_statuses,
        "rule_engine": rule_result,
    }

    return {
        "merged_analysis": merged_analysis,
        "warnings": warnings,
    }