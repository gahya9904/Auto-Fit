import logging
from time import perf_counter
from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.graphs.nodes.rag_node import rag_node

from app.schemas.recommendation import (
    DietIngredient,
    DietRecommendationRequest,
    DietRecommendationResponse,
    ReplaceMealRequest,
    ReplaceMealResponse,
)

from app.services.diet_context_service import (
    build_diet_safety_tags,
)


logger = logging.getLogger(
    __name__
)


# =========================================================
# Optimization Settings
# =========================================================

# Diet LLM에 전달할 최대 RAG chunk 수
MAX_DIET_RAG_CHUNKS = 6

# 각 RAG chunk에서 전달할 최대 글자 수
MAX_RAG_CONTENT_CHARS = 1200

# 주간 식단 생성 최대 output token
WEEKLY_DIET_MAX_OUTPUT_TOKENS = 10000

# 한 끼 재추천 최대 output token
REPLACE_MEAL_MAX_OUTPUT_TOKENS = 1800


# =========================================================
# Text Utility
# =========================================================


def _normalize_text(
    value: str,
) -> str:
    return (
        value
        .strip()
        .lower()
        .replace(" ", "")
    )


# =========================================================
# Refrigerator Utility
# =========================================================


def _normalize_refrigerator_ingredients(
    ingredients: list[str] | None,
) -> list[str]:
    """
    냉장고 재료 목록 정규화.

    - 빈 값 제거
    - 앞뒤 공백 제거
    - 공백/대소문자를 무시하여 중복 제거
    """

    if not ingredients:
        return []

    result: list[str] = []
    seen: set[str] = set()

    for ingredient in ingredients:
        if not ingredient:
            continue

        cleaned = ingredient.strip()

        if not cleaned:
            continue

        normalized = _normalize_text(
            cleaned
        )

        if normalized in seen:
            continue

        result.append(
            cleaned
        )

        seen.add(
            normalized
        )

    return result


def _build_refrigerator_map(
    ingredients: list[str],
) -> dict[str, str]:
    """
    정규화된 이름 → 원래 냉장고 재료 이름.
    """

    result: dict[str, str] = {}

    for item in ingredients:
        normalized = _normalize_text(
            item
        )

        if not normalized:
            continue

        result[
            normalized
        ] = item

    return result


def _filter_used_refrigerator_ingredients(
    *,
    generated_ingredients: (
        list[DietIngredient]
        | None
    ),
    refrigerator_ingredients: list[str],
) -> list[DietIngredient] | None:
    """
    LLM 결과 ingredients 중
    실제 냉장고에 존재하는 재료만 남긴다.

    냉장고가 비어 있으면 ingredients는 null.
    """

    if not refrigerator_ingredients:
        return None

    if not generated_ingredients:
        return []

    refrigerator_map = (
        _build_refrigerator_map(
            refrigerator_ingredients
        )
    )

    result: list[
        DietIngredient
    ] = []

    used_names: set[str] = set()

    for ingredient in generated_ingredients:
        normalized = _normalize_text(
            ingredient.name
        )

        actual_name = (
            refrigerator_map.get(
                normalized
            )
        )

        if actual_name is None:
            continue

        normalized_actual = (
            _normalize_text(
                actual_name
            )
        )

        if normalized_actual in used_names:
            continue

        validated = (
            ingredient.model_copy(
                update={
                    "name": (
                        actual_name
                    )
                }
            )
        )

        result.append(
            validated
        )

        used_names.add(
            normalized_actual
        )

    return result


# =========================================================
# Menu Diversity Validation
# =========================================================


def _collect_menu_names(
    response: DietRecommendationResponse,
) -> list[str]:
    """
    7일 × 4끼 = 28개 메뉴명 수집.
    """

    menu_names: list[str] = []

    for day_plan in response.weekly_plan:
        meals = day_plan.meals

        menu_names.extend(
            [
                meals.breakfast.menu_name,
                meals.lunch.menu_name,
                meals.dinner.menu_name,
                meals.snack.menu_name,
            ]
        )

    return menu_names


def _find_duplicate_menu_names(
    response: DietRecommendationResponse,
) -> list[str]:
    """
    동일한 메뉴명이 반복됐는지 확인한다.

    성능 최적화를 위해 중복이 있어도
    전체 28끼를 다시 생성하지 않고
    로그만 남긴다.
    """

    menu_names = (
        _collect_menu_names(
            response
        )
    )

    counts: dict[str, int] = {}
    display_names: dict[str, str] = {}

    for name in menu_names:
        normalized = (
            _normalize_text(
                name
            )
        )

        counts[
            normalized
        ] = (
            counts.get(
                normalized,
                0,
            )
            + 1
        )

        if normalized not in display_names:
            display_names[
                normalized
            ] = name

    duplicates = [
        display_names[
            normalized
        ]
        for normalized, count
        in counts.items()
        if count > 1
    ]

    return duplicates


# =========================================================
# RAG
# =========================================================


async def _get_diet_rag_context(
    metric_statuses: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Rule Engine status 기반 RAG 검색.
    """

    if not metric_statuses:
        return []

    start = perf_counter()

    try:
        result = await rag_node(
            {
                "merged_analysis": {
                    "metric_statuses": (
                        metric_statuses
                    )
                },
                "warnings": [],
            }
        )

    except Exception:
        logger.exception(
            "Diet RAG search failed"
        )
        return []

    finally:
        elapsed = (
            perf_counter()
            - start
        )

        logger.info(
            "Diet RAG elapsed_seconds=%.2f",
            elapsed,
        )

    rag_context = result.get(
        "rag_context",
        [],
    )

    if not isinstance(
        rag_context,
        list,
    ):
        return []

    return rag_context


def _build_safe_rag_context(
    rag_context: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    OpenAI에 전달하는 RAG context를 최소화한다.

    성능 최적화:
    - 최대 6개 chunk
    - chunk content 최대 1200자
    - 필요한 metadata만 전달
    """

    safe_context: list[
        dict[str, Any]
    ] = []

    for item in rag_context[
        :MAX_DIET_RAG_CHUNKS
    ]:
        if not isinstance(
            item,
            dict,
        ):
            continue

        content = (
            item.get(
                "content"
            )
            or item.get(
                "content_preview"
            )
        )

        if not content:
            continue

        content_text = str(
            content
        )

        safe_context.append(
            {
                "content": (
                    content_text[
                        :MAX_RAG_CONTENT_CHARS
                    ]
                ),
                "source_org": (
                    item.get(
                        "source_org"
                    )
                ),
                "title": (
                    item.get(
                        "title"
                    )
                ),
                "topic": (
                    item.get(
                        "topic"
                    )
                ),
            }
        )

    return safe_context


# =========================================================
# Refrigerator Prompt
# =========================================================


def _build_refrigerator_instruction(
    refrigerator_ingredients: list[str],
) -> str:
    """
    냉장고 재료 관련 LLM instruction.
    """

    if refrigerator_ingredients:
        return f"""
[냉장고 재료]
{refrigerator_ingredients}

냉장고 활용 규칙:

- 위 재료를 활용할 수 있는 메뉴를 우선적으로 고려한다.
- 모든 끼니에 냉장고 재료를 반드시 사용할 필요는 없다.
- 동일 재료를 연속된 여러 끼니의 주재료로 반복하지 않는다.
- 냉장고 재료만으로 메뉴 다양성을 제한하지 않는다.
- 필요하면 일반적인 추가 식재료를 사용할 수 있다.
- 알레르기와 건강 안전 조건을 냉장고 활용보다 우선한다.

ingredients 규칙:

- ingredients는 전체 레시피 재료 목록이 아니다.
- 실제 해당 메뉴에 사용한 냉장고 재료만 기록한다.
- 냉장고에 없는 일반 재료와 조미료는 기록하지 않는다.
- 필요 이상으로 많은 냉장고 재료를 한 메뉴에 넣지 않는다.
- 한 메뉴당 실제 사용한 핵심 냉장고 재료만 기록한다.

각 ingredients 항목:

- name
- recommended_amount
- unit
- carbohydrate_g
- protein_g
- fat_g
- estimated_calories_kcal

recommended_amount와 모든 영양값은 정수다.
""".strip()

    return """
[냉장고 재료]
제공되지 않음.

규칙:

- 일반적인 식재료로 현실적인 식단을 구성한다.
- 7일간 메뉴 다양성을 확보한다.
- 모든 메뉴의 ingredients는 반드시 null이다.
""".strip()


# =========================================================
# Ingredient Post Validation
# =========================================================


def _validate_weekly_plan_ingredients(
    *,
    response: DietRecommendationResponse,
    refrigerator_ingredients: list[str],
) -> DietRecommendationResponse:
    """
    28끼 ingredients를 최종 검증하여
    실제 냉장고 재료만 남긴다.
    """

    updated_days = []

    for day_plan in response.weekly_plan:
        meals = day_plan.meals

        breakfast = (
            meals.breakfast.model_copy(
                update={
                    "ingredients": (
                        _filter_used_refrigerator_ingredients(
                            generated_ingredients=(
                                meals
                                .breakfast
                                .ingredients
                            ),
                            refrigerator_ingredients=(
                                refrigerator_ingredients
                            ),
                        )
                    )
                }
            )
        )

        lunch = (
            meals.lunch.model_copy(
                update={
                    "ingredients": (
                        _filter_used_refrigerator_ingredients(
                            generated_ingredients=(
                                meals
                                .lunch
                                .ingredients
                            ),
                            refrigerator_ingredients=(
                                refrigerator_ingredients
                            ),
                        )
                    )
                }
            )
        )

        dinner = (
            meals.dinner.model_copy(
                update={
                    "ingredients": (
                        _filter_used_refrigerator_ingredients(
                            generated_ingredients=(
                                meals
                                .dinner
                                .ingredients
                            ),
                            refrigerator_ingredients=(
                                refrigerator_ingredients
                            ),
                        )
                    )
                }
            )
        )

        snack = (
            meals.snack.model_copy(
                update={
                    "ingredients": (
                        _filter_used_refrigerator_ingredients(
                            generated_ingredients=(
                                meals
                                .snack
                                .ingredients
                            ),
                            refrigerator_ingredients=(
                                refrigerator_ingredients
                            ),
                        )
                    )
                }
            )
        )

        updated_meals = (
            meals.model_copy(
                update={
                    "breakfast": (
                        breakfast
                    ),
                    "lunch": (
                        lunch
                    ),
                    "dinner": (
                        dinner
                    ),
                    "snack": (
                        snack
                    ),
                }
            )
        )

        updated_days.append(
            day_plan.model_copy(
                update={
                    "meals": (
                        updated_meals
                    )
                }
            )
        )

    return response.model_copy(
        update={
            "weekly_plan": (
                updated_days
            )
        }
    )


# =========================================================
# OpenAI Weekly Diet Generation
# =========================================================


async def _request_weekly_diet_from_llm(
    *,
    client: AsyncOpenAI,
    model: str,
    metric_statuses: dict[str, str],
    safety_tags: list[str],
    food_allergens: list[str],
    goal_type: str,
    additional_input: (
        str
        | list[str]
        | None
    ),
    refrigerator_instruction: str,
    safe_rag_context: list[
        dict[str, Any]
    ],
) -> DietRecommendationResponse:
    """
    주간 식단 Structured Output 생성.

    최적화 핵심:
    - OpenAI 호출 1회
    - image_prompt 생성 제거
    - description/guidance 길이 제한
    - RAG context 축소
    """

    instructions = """
너는 Auto-Fit의 개인 맞춤 식단 추천 AI다.

추천 우선순위:

1. 알레르기 및 명시적 섭취 제한
2. 건강 상태 및 안전성
3. 사용자 목표
4. 냉장고 재료 활용
5. 영양 균형
6. 메뉴 다양성
7. 현실적인 조리 및 섭취 가능성


건강 규칙:

- 의료 진단이나 치료 처방을 하지 않는다.
- 알레르기 재료는 절대 사용하지 않는다.
- 제공되지 않은 건강 수치를 추측하지 않는다.
- metric_statuses만을 건강 상태 판단에 사용한다.
- 제공된 공식 RAG 근거를 참고한다.


주간 식단 규칙:

- 정확히 7일 생성한다.
- monday부터 sunday까지 정확히 한 번씩 생성한다.
- 매일 breakfast, lunch, dinner, snack을 하나씩 생성한다.
- 총 28개 식사 슬롯이다.


메뉴 다양성 규칙:

- 동일한 menu_name을 반복하지 않는다.
- 같은 주재료를 연속적으로 지나치게 반복하지 않는다.
- 같은 조리법을 연속적으로 반복하지 않는다.
- 구이, 찜, 국, 볶음, 샐러드, 덮밥, 비빔밥,
  오믈렛, 죽, 수프 등 다양한 형태를 사용한다.
- 이름만 바꾼 사실상 동일한 메뉴를 피한다.


출력 최적화 규칙:

- menu_description은 간결한 한국어 한 문장으로 작성한다.
- menu_description은 가능하면 60자 이내로 작성한다.
- guidance는 가장 중요한 조언 하나만 한국어 한 문장으로 작성한다.
- guidance는 가능하면 40자 이내로 작성한다.
- 불필요한 설명을 반복하지 않는다.


image_prompt 규칙:

- 주간 식단에서는 image_prompt를 생성하지 않는다.
- 모든 메뉴의 image_prompt는 반드시 null로 반환한다.
- 음식 이미지 프롬프트는 별도 이미지 서버에서 생성한다.


냉장고 재료 규칙:

- 냉장고 재료가 있으면 우선 활용한다.
- 모든 메뉴에 냉장고 재료를 강제로 넣지 않는다.
- 동일한 냉장고 재료가 지나치게 반복되지 않도록 한다.
- 필요하면 일반적인 추가 식재료를 사용할 수 있다.
- ingredients에는 실제 사용한 냉장고 재료만 기록한다.
- 전체 레시피 재료 목록을 기록하지 않는다.
- 냉장고 재료가 없으면 ingredients는 반드시 null이다.


메뉴 출력 필드:

각 메뉴에는 반드시 다음 값을 생성한다.

- menu_name
- menu_description
- image_prompt
- estimated_calories_kcal
- nutrition.carbohydrate_g
- nutrition.protein_g
- nutrition.fat_g
- ingredients
- guidance


숫자 규칙:

- estimated_calories_kcal은 정수
- carbohydrate_g는 정수
- protein_g는 정수
- fat_g는 정수
- ingredients 내부 영양정보는 정수
- ingredients.recommended_amount는 정수


ingredients 규칙:

냉장고 재료를 사용한 경우 각 항목에는:

- name
- recommended_amount
- unit
- carbohydrate_g
- protein_g
- fat_g
- estimated_calories_kcal

를 포함한다.

ingredients는 메뉴 전체 영양정보와 별개로
해당 냉장고 재료의 예상 영양정보만 표시한다.


출력은 Structured Output Schema를 정확히 따른다.
""".strip()

    prompt = f"""
[건강 상태]
{metric_statuses}

[건강 안전 태그]
{safety_tags}

[사용자 목표]
{goal_type}

[알레르기]
{food_allergens}

[추가 사용자 입력]
{additional_input}

{refrigerator_instruction}

[검증된 건강 가이드라인 RAG]
{safe_rag_context}

위 정보를 바탕으로
건강 조건을 고려한 현실적인
7일 개인 맞춤 식단을 생성하라.
"""

    start = perf_counter()

    try:
        response = await client.responses.parse(
            model=model,
            instructions=instructions,
            input=prompt,
            reasoning={
                "effort": "minimal"
            },
            text_format=(
                DietRecommendationResponse
            ),
            max_output_tokens=(
                WEEKLY_DIET_MAX_OUTPUT_TOKENS
            ),
        )

    except Exception:
        logger.exception(
            "Weekly diet OpenAI generation failed"
        )
        raise

    finally:
        elapsed = (
            perf_counter()
            - start
        )

        logger.info(
            "Weekly diet OpenAI elapsed_seconds=%.2f",
            elapsed,
        )

    result = response.output_parsed

    if result is None:
        raise RuntimeError(
            "Diet recommendation output is empty"
        )

    return result


# =========================================================
# Diet Recommendation
# =========================================================


async def generate_diet_recommendation(
    request: DietRecommendationRequest,
) -> DietRecommendationResponse:
    """
    7일 식단 생성.

    최적화:
    - RAG 검색 1회
    - OpenAI 생성 1회
    - 전체 재생성 retry 제거
    """

    total_start = perf_counter()

    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured"
        )

    client = AsyncOpenAI(
        api_key=(
            settings.openai_api_key
        )
    )

    metric_statuses = (
        request.metric_statuses
        or {}
    )

    safety_tags = (
        build_diet_safety_tags(
            metric_statuses
        )
    )

    rag_context = (
        await _get_diet_rag_context(
            metric_statuses
        )
    )

    safe_rag_context = (
        _build_safe_rag_context(
            rag_context
        )
    )

    refrigerator_ingredients = (
        _normalize_refrigerator_ingredients(
            request.refrigerator_ingredients
        )
    )

    food_allergens = (
        request.food_allergens
        or []
    )

    goal_type = (
        request.goal_type
        or "general_health"
    )

    additional_input = (
        request.additional_input
    )

    refrigerator_instruction = (
        _build_refrigerator_instruction(
            refrigerator_ingredients
        )
    )

    # -----------------------------------------------------
    # OpenAI 1회 생성
    # -----------------------------------------------------

    result = (
        await _request_weekly_diet_from_llm(
            client=client,
            model=(
                settings.openai_model
            ),
            metric_statuses=(
                metric_statuses
            ),
            safety_tags=(
                safety_tags
            ),
            food_allergens=(
                food_allergens
            ),
            goal_type=(
                goal_type
            ),
            additional_input=(
                additional_input
            ),
            refrigerator_instruction=(
                refrigerator_instruction
            ),
            safe_rag_context=(
                safe_rag_context
            ),
        )
    )

    # -----------------------------------------------------
    # 메뉴 중복 확인
    # 전체 재생성은 하지 않음
    # -----------------------------------------------------

    duplicates = (
        _find_duplicate_menu_names(
            result
        )
    )

    if duplicates:
        logger.warning(
            "Weekly diet contains duplicate menu names: count=%d",
            len(
                duplicates
            ),
        )

    # -----------------------------------------------------
    # 냉장고 ingredients 최종 검증
    # -----------------------------------------------------

    result = (
        _validate_weekly_plan_ingredients(
            response=result,
            refrigerator_ingredients=(
                refrigerator_ingredients
            ),
        )
    )

    total_elapsed = (
        perf_counter()
        - total_start
    )

    logger.info(
        "Diet recommendation total elapsed_seconds=%.2f",
        total_elapsed,
    )

    return result


# =========================================================
# Replace Meal
# =========================================================


async def generate_replacement_meal(
    request: ReplaceMealRequest,
) -> ReplaceMealResponse:
    """
    한 끼 재추천.

    한 끼 응답은 크기가 작기 때문에
    image_prompt 생성은 그대로 유지한다.
    """

    total_start = perf_counter()

    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured"
        )

    client = AsyncOpenAI(
        api_key=(
            settings.openai_api_key
        )
    )

    metric_statuses = (
        request.metric_statuses
        or {}
    )

    safety_tags = (
        build_diet_safety_tags(
            metric_statuses
        )
    )

    rag_context = (
        await _get_diet_rag_context(
            metric_statuses
        )
    )

    safe_rag_context = (
        _build_safe_rag_context(
            rag_context
        )
    )

    refrigerator_ingredients = (
        _normalize_refrigerator_ingredients(
            request.refrigerator_ingredients
        )
    )

    food_allergens = (
        request.food_allergens
        or []
    )

    goal_type = (
        request.goal_type
        or "general_health"
    )

    additional_input = (
        request.additional_input
    )

    current_ingredients = (
        request.current_ingredients
        or []
    )

    refrigerator_instruction = (
        _build_refrigerator_instruction(
            refrigerator_ingredients
        )
    )

    instructions = """
너는 Auto-Fit의 한 끼 식단 재추천 AI다.

추천 우선순위:

1. 알레르기 및 섭취 제한
2. 건강 상태 및 안전성
3. 사용자 목표
4. 냉장고 재료 활용
5. 기존 메뉴와 다른 메뉴
6. 영양 균형
7. 메뉴 다양성


규칙:

- 현재 메뉴와 다른 메뉴를 생성한다.
- 메뉴 이름만 변경한 유사 메뉴를 생성하지 않는다.
- 가능하면 주재료 또는 조리 방식도 변경한다.
- 알레르기 재료는 절대 사용하지 않는다.
- 의료 진단이나 치료 지시는 하지 않는다.


새 메뉴에는 반드시 다음 값을 포함한다.

- menu_name
- menu_description
- image_prompt
- estimated_calories_kcal
- nutrition.carbohydrate_g
- nutrition.protein_g
- nutrition.fat_g
- ingredients
- guidance


응답 길이 규칙:

- menu_description은 한국어 한 문장으로 간결하게 작성한다.
- guidance는 가장 중요한 조언 하나만 간결하게 작성한다.


image_prompt 규칙:

- Stable Diffusion 음식 이미지 생성용 영어 프롬프트로 작성한다.
- 메뉴명을 단순 번역하지 말고 음식 외형을 구체적으로 묘사한다.
- 주요 식재료의 색상, 형태, 조리 방식을 표현한다.
- 실제 메뉴에 없는 주요 식재료를 추가하지 않는다.
- realistic professional food photography 스타일을 사용한다.
- 사람, 손, 얼굴, 글자, 워터마크, 로고는 포함하지 않는다.
- 건강정보와 칼로리 숫자를 포함하지 않는다.
- 영어 1~2문장으로 간결하게 작성한다.


냉장고 재료가 있는 경우:

- 냉장고 재료를 우선 활용한다.
- 실제 사용한 냉장고 재료만 ingredients에 기록한다.


냉장고 재료가 없는 경우:

- ingredients는 반드시 null이다.


모든 kcal, 탄수화물, 단백질, 지방,
recommended_amount 값은 정수다.

출력은 Structured Output Schema를 따른다.
""".strip()

    prompt = f"""
[교체 대상]
요일: {request.target_day}
식사: {request.target_meal}

[현재 메뉴]
{request.current_menu_name}

[현재 메뉴 재료]
{current_ingredients}

[건강 상태]
{metric_statuses}

[건강 안전 태그]
{safety_tags}

[사용자 목표]
{goal_type}

[알레르기]
{food_allergens}

[추가 입력]
{additional_input}

{refrigerator_instruction}

[검증된 건강 가이드라인 RAG]
{safe_rag_context}

현재 메뉴와 확실히 다른
새로운 메뉴 하나를 생성하라.
"""

    llm_start = perf_counter()

    try:
        response = await client.responses.parse(
            model=(
                settings.openai_model
            ),
            instructions=instructions,
            input=prompt,
            reasoning={
                "effort": "minimal"
            },
            text_format=(
                ReplaceMealResponse
            ),
            max_output_tokens=(
                REPLACE_MEAL_MAX_OUTPUT_TOKENS
            ),
        )

    except Exception:
        logger.exception(
            "Replacement meal OpenAI generation failed"
        )
        raise

    finally:
        llm_elapsed = (
            perf_counter()
            - llm_start
        )

        logger.info(
            "Replacement meal OpenAI elapsed_seconds=%.2f",
            llm_elapsed,
        )

    result = response.output_parsed

    if result is None:
        raise RuntimeError(
            "Replacement meal output is empty"
        )

    validated_ingredients = (
        _filter_used_refrigerator_ingredients(
            generated_ingredients=(
                result.meal.ingredients
            ),
            refrigerator_ingredients=(
                refrigerator_ingredients
            ),
        )
    )

    validated_meal = (
        result.meal.model_copy(
            update={
                "ingredients": (
                    validated_ingredients
                )
            }
        )
    )

    final_result = (
        result.model_copy(
            update={
                "meal": (
                    validated_meal
                )
            }
        )
    )

    total_elapsed = (
        perf_counter()
        - total_start
    )

    logger.info(
        "Replacement meal total elapsed_seconds=%.2f",
        total_elapsed,
    )

    return final_result
