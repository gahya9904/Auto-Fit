from app.graphs.state import AnalysisGraphState
from app.schemas.analysis import (
    AnalysisRequest,
    BodyData,
    HealthData,
)
from app.services.rule_engine_service import (
    rule_engine_service,
)


def rule_engine_node(
    state: AnalysisGraphState,
) -> AnalysisGraphState:
    body_data = state.get("body_data", {})
    health_data = state.get("health_data", {})

    safe_request = AnalysisRequest(
        user_id=None,
        question=None,
        body_data=BodyData(**body_data),
        health_data=HealthData(**health_data),
    )

    result = rule_engine_service.analyze(
        safe_request
    )

    return {
        "rule_engine_result": result.model_dump()
    }