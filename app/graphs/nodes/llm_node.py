import json

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.graphs.state import AnalysisGraphState
from app.schemas.analysis import FinalAnswer


SYSTEM_INSTRUCTIONS = """
너는 Auto-Fit 헬스케어 애플리케이션의 AI 건강관리 도우미다.

반드시 제공된 분석 결과와 검증된 RAG 근거를 기반으로만 답변한다.

규칙:
- 의료 진단을 확정적으로 하지 않는다.
- 특정 질병이 있다고 단정하지 않는다.
- 건강 위험요인이나 관련 가능성 수준으로 설명한다.
- 운동과 식단은 일반적인 건강관리 목적의 추천만 제공한다.
- 검증된 RAG 근거가 없는 의학적 사실은 임의로 생성하지 않는다.
- 개인정보, 사용자 식별정보, 인증정보를 출력하지 않는다.
- 출처는 실제 rag_context에 존재하는 자료만 사용한다.
""".strip()


def _build_llm_input(
    state: AnalysisGraphState,
) -> str:
    """
    개인정보 없이
    Rule Engine + 검증된 RAG 결과만 LLM에 전달한다.
    """

    merged_analysis = state.get(
        "merged_analysis",
        {},
    )

    rag_context = state.get(
        "rag_context",
        [],
    )

    payload = {
        "analysis": merged_analysis,
        "rag_context": rag_context,
    }

    return json.dumps(
        payload,
        ensure_ascii=False,
    )


def _get_openai_client() -> AsyncOpenAI:
    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured"
        )

    return AsyncOpenAI(
        api_key=settings.openai_api_key
    )


async def llm_node(
    state: AnalysisGraphState,
) -> AnalysisGraphState:
    """
    Rule Engine + 검증된 RAG 근거를 이용하여
    구조화된 최종 건강관리 안내를 생성한다.
    """

    settings = get_settings()

    warnings = state.get(
        "warnings",
        [],
    ).copy()

    rag_context = state.get(
        "rag_context",
        [],
    )

    if not settings.openai_api_key:
        warnings.append(
            "OPENAI_API_KEY가 설정되지 않았습니다."
        )

        return {
            "final_answer": {},
            "warnings": warnings,
        }

    # RAG 근거가 없는 사실을 출처처럼 사용하지 않도록 경고
    if not rag_context:
        warnings.append(
            "검증된 RAG 근거가 없어 제한된 범위에서만 안내합니다."
        )

    prompt = _build_llm_input(
        state
    )

    try:
        client = _get_openai_client()

        response = await client.responses.parse(
            model=settings.openai_model,
            instructions=SYSTEM_INSTRUCTIONS,
            input=f"""
아래 분석 결과와 RAG 근거를 이용하여
사용자에게 제공할 건강관리 안내를 작성하세요.

주의:
- analysis에 없는 수치를 만들어내지 마세요.
- rag_context에 없는 출처를 만들어내지 마세요.
- 확정적인 질병 진단을 하지 마세요.
- 운동과 식단은 일반적인 관리 방향으로 안내하세요.
- RAG 근거가 없으면 sources는 빈 배열로 두세요.

데이터:
{prompt}
""",
            text_format=FinalAnswer,
            max_output_tokens=1500,
        )

        parsed = response.output_parsed

        if parsed is None:
            warnings.append(
                "LLM 구조화 응답을 생성하지 못했습니다."
            )

            return {
                "final_answer": {},
                "warnings": warnings,
            }

        return {
            "final_answer": parsed.model_dump(),
            "warnings": warnings,
        }

    except Exception:
        warnings.append(
            "LLM 최종 분석을 수행하지 못했습니다."
        )

        return {
            "final_answer": {},
            "warnings": warnings,
        }