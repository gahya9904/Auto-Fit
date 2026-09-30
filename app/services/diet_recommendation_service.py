import asyncio
import logging
from time import perf_counter
from typing import Any

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.graphs.nodes.rag_node import rag_node

from app.schemas.recommendation import (
    DietIngredient,
    DietRecommendationMetadataResponse,
    DietRecommendationRequest,
    DietRecommendationResponse,
    DietWeeklyPlanPartResponse,
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

MAX_DIET_RAG_CHUNKS = 6
MAX_RAG_CONTENT_CHARS = 1200

FIRST_DAY_GROUP = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
]

SECOND_DAY_GROUP = [
    "friday",
    "saturday",
    "sunday",
]

FIRST_GROUP_MAX_OUTPUT_TOKENS = 6500
SECOND_GROUP_MAX_OUTPUT_TOKENS = 5500
METADATA_MAX_OUTPUT_TOKENS = 2500

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

        if (
            normalized_actual
            in used_names
        ):
            continue

        validated = (
            ingredient.model_copy(
                update={
                    "name": actual_name
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
# Menu Utility
# =========================================================


def _collect_menu_names(
    response: DietRecommendationResponse,
) -> list[str]:
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

        if (
            normalized
            not in display_names
        ):
            display_names[
                normalized
            ] = name

    return [
        display_names[
            normalized
        ]
        for normalized, count
        in counts.items()
        if count > 1
    ]


def _day_value(
    day_plan: Any,
) -> str:

    value = getattr(
        day_plan,
        "day",
        "",
    )

    if hasattr(
        value,
        "value",
    ):
        value = value.value

    return str(
        value
    ).lower()


def _sort_weekly_plan(
    weekly_plan: list[Any],
) -> list[Any]:

    day_order = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    return sorted(
        weekly_plan,
        key=lambda item: (
            day_order.get(
                _day_value(
                    item
                ),
                999,
            )
        ),
    )


# =========================================================
# RAG
# =========================================================


async def _get_diet_rag_context(
    metric_statuses: dict[str, str],
) -> list[dict[str, Any]]:

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
        logger.info(
            "Diet RAG elapsed_seconds=%.2f",
            (
                perf_counter()
                - start
            ),
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

        safe_context.append(
            {
                "content": (
                    str(content)[
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

    if refrigerator_ingredients:
        return f"""
[냉장고 재료]
{refrigerator_ingredients}

규칙:

- 냉장고 재료를 우선 활용한다.
- 모든 끼니에 냉장고 재료를 강제로 사용할 필요는 없다.
- 동일 재료가 지나치게 반복되지 않도록 한다.
- 필요하면 일반 식재료를 추가할 수 있다.
- 알레르기와 건강 안전 조건을 최우선으로 한다.

ingredients 규칙:

- 전체 레시피 재료가 아니다.
- 실제 메뉴에 사용한 냉장고 재료만 기록한다.
- 냉장고에 없는 재료나 조미료는 기록하지 않는다.
- 필요한 핵심 냉장고 재료만 포함한다.

각 ingredients 항목:

- name
- recommended_amount
- unit
- carbohydrate_g
- protein_g
- fat_g
- estimated_calories_kcal

모든 수치는 정수로 반환한다.
""".strip()

    return """
[냉장고 재료]
제공되지 않음.

규칙:

- 일반 식재료를 사용하여 현실적인 메뉴를 구성한다.
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
                    "breakfast": breakfast,
                    "lunch": lunch,
                    "dinner": dinner,
                    "snack": snack,
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
# Parallel Weekly Plan Generation
# =========================================================


async def _request_diet_days_from_llm(
    *,
    client: AsyncOpenAI,
    model: str,
    days: list[str],
    max_output_tokens: int,
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
) -> DietWeeklyPlanPartResponse:

    slot_count = (
        len(days)
        * 4
    )

    instructions = """
너는 Auto-Fit의 개인 맞춤 식단 추천 AI다.

건강 및 안전 우선순위:

1. 알레르기 및 명시적 제한
2. 건강 상태 및 안전성
3. 사용자 목표
4. 냉장고 재료 활용
5. 영양 균형
6. 메뉴 다양성

규칙:

- 요청받은 요일만 생성한다.
- 각 요일마다 breakfast, lunch, dinner, snack을 정확히 생성한다.
- 요청되지 않은 요일은 생성하지 않는다.
- 동일한 menu_name을 반복하지 않는다.
- 같은 주재료와 조리법의 반복을 줄인다.
- 메뉴 이름만 다르고 사실상 같은 음식은 피한다.
- 의료 진단 또는 치료 처방을 하지 않는다.
- 제공되지 않은 건강 수치는 추측하지 않는다.

출력 길이 규칙:

- menu_description은 한국어 한 문장으로 간결하게 작성한다.
- guidance는 가장 중요한 내용 한 문장만 작성한다.
- 불필요한 설명은 작성하지 않는다.

image_prompt:

- 모든 image_prompt는 반드시 null이다.
- 이미지 프롬프트는 별도 이미지 서버에서 생성한다.

ingredients:

- 냉장고 재료가 있으면 실제 사용한 냉장고 재료만 기록한다.
- 전체 레시피 재료를 기록하지 않는다.
- 냉장고 재료가 없으면 반드시 null이다.
- 한 메뉴에 불필요하게 많은 ingredients를 넣지 않는다.

숫자:

- kcal은 정수
- 탄수화물은 정수
- 단백질은 정수
- 지방은 정수
- recommended_amount는 정수

Structured Output Schema를 정확히 따른다.
""".strip()

    prompt = f"""
[생성 대상 요일]
{days}

[생성해야 하는 총 식사 슬롯]
{slot_count}

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

위 조건을 만족하는
지정된 요일의 식단만 생성하라.
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
                DietWeeklyPlanPartResponse
            ),
            max_output_tokens=(
                max_output_tokens
            ),
        )

    except Exception:
        logger.exception(
            "Parallel diet day generation failed"
        )
        raise

    finally:
        logger.info(
            "Diet partial generation elapsed_seconds=%.2f days=%d",
            (
                perf_counter()
                - start
            ),
            len(days),
        )

    result = response.output_parsed

    if result is None:
        raise RuntimeError(
            "Partial diet output is empty"
        )

    expected_days = set(
        days
    )

    actual_days = {
        _day_value(
            item
        )
        for item in result.weekly_plan
    }

    if (
        len(result.weekly_plan)
        != len(days)
        or actual_days
        != expected_days
    ):
        raise ValueError(
            "Partial diet response contains "
            "unexpected or missing days."
        )

    return result


# =========================================================
# Metadata Generation
# =========================================================


async def _request_diet_metadata_from_llm(
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
    safe_rag_context: list[
        dict[str, Any]
    ],
) -> DietRecommendationMetadataResponse:

    instructions = """
너는 Auto-Fit의 개인 맞춤 식단 추천 AI다.

주간 식단의 공통 설명 정보만 생성한다.
weekly_plan은 생성하지 않는다.

규칙:

- 건강 상태는 metric_statuses만 사용한다.
- 의료 진단이나 치료 처방을 하지 않는다.
- 알레르기와 안전 조건을 우선한다.
- 사용자의 목표에 맞는 현실적인 식단 전략을 제시한다.
- 불필요하게 긴 설명을 작성하지 않는다.

sources 규칙:

- sources는 반드시 제공된 RAG 문서만 사용한다.
- RAG에 없는 출처를 새로 만들지 않는다.
- 각 source에는 source_org와 title을 정확히 넣는다.
- WHO, USDA 등의 출처가 RAG에 없다면 임의로 추가하지 않는다.

Structured Output Schema를 정확히 따른다.
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

[검증된 건강 가이드라인 RAG]
{safe_rag_context}

위 정보를 바탕으로
주간 식단의 공통 전략과 근거 정보를 생성하라.
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
                DietRecommendationMetadataResponse
            ),
            max_output_tokens=(
                METADATA_MAX_OUTPUT_TOKENS
            ),
        )

    except Exception:
        logger.exception(
            "Diet metadata generation failed"
        )
        raise

    finally:
        logger.info(
            "Diet metadata generation elapsed_seconds=%.2f",
            (
                perf_counter()
                - start
            ),
        )

    result = response.output_parsed

    if result is None:
        raise RuntimeError(
            "Diet metadata output is empty"
        )

    return result


# =========================================================
# Diet Recommendation
# =========================================================


async def generate_diet_recommendation(
    request: DietRecommendationRequest,
) -> DietRecommendationResponse:

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

    refrigerator_instruction = (
        _build_refrigerator_instruction(
            refrigerator_ingredients
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

    (
        first_result,
        second_result,
        metadata_result,
    ) = await asyncio.gather(
        _request_diet_days_from_llm(
            client=client,
            model=(
                settings.openai_model
            ),
            days=(
                FIRST_DAY_GROUP
            ),
            max_output_tokens=(
                FIRST_GROUP_MAX_OUTPUT_TOKENS
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
        ),
        _request_diet_days_from_llm(
            client=client,
            model=(
                settings.openai_model
            ),
            days=(
                SECOND_DAY_GROUP
            ),
            max_output_tokens=(
                SECOND_GROUP_MAX_OUTPUT_TOKENS
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
        ),
        _request_diet_metadata_from_llm(
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
            safe_rag_context=(
                safe_rag_context
            ),
        ),
    )

    combined_weekly_plan = (
        list(
            first_result.weekly_plan
        )
        + list(
            second_result.weekly_plan
        )
    )

    combined_weekly_plan = (
        _sort_weekly_plan(
            combined_weekly_plan
        )
    )

    metadata_payload = (
        metadata_result.model_dump()
    )

    final_payload = {
        **metadata_payload,
        "weekly_plan": (
            combined_weekly_plan
        ),
    }

    result = (
        DietRecommendationResponse
        .model_validate(
            final_payload
        )
    )

    result = (
        _validate_weekly_plan_ingredients(
            response=result,
            refrigerator_ingredients=(
                refrigerator_ingredients
            ),
        )
    )

    duplicates = (
        _find_duplicate_menu_names(
            result
        )
    )

    if duplicates:
        logger.warning(
            "Parallel diet result contains duplicate menu names count=%d",
            len(duplicates),
        )

    logger.info(
        "Parallel diet recommendation total elapsed_seconds=%.2f",
        (
            perf_counter()
            - total_start
        ),
    )

    return result


# =========================================================
# Replace Meal
# =========================================================


async def generate_replacement_meal(
    request: ReplaceMealRequest,
) -> ReplaceMealResponse:

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
- 이름만 바꾼 유사 메뉴를 생성하지 않는다.
- 가능하면 주재료 또는 조리 방식도 변경한다.
- 알레르기 재료는 사용하지 않는다.
- 의료 진단이나 치료 지시를 하지 않는다.

새 메뉴에는 다음 값을 포함한다.

- menu_name
- menu_description
- image_prompt
- estimated_calories_kcal
- nutrition.carbohydrate_g
- nutrition.protein_g
- nutrition.fat_g
- ingredients
- guidance

응답 길이:

- menu_description은 간결한 한 문장이다.
- guidance는 가장 중요한 조언 한 문장이다.

image_prompt:

- Stable Diffusion 음식 이미지 생성용 영어 프롬프트다.
- 실제 음식의 주요 재료와 조리 상태를 표현한다.
- 실제 메뉴에 없는 주요 재료를 추가하지 않는다.
- realistic professional food photography 스타일을 사용한다.
- 사람, 손, 글자, 로고, 워터마크는 포함하지 않는다.
- 건강정보와 칼로리 숫자는 넣지 않는다.
- 영어 1~2문장으로 작성한다.

냉장고 재료가 있으면:

- 실제 사용한 냉장고 재료만 ingredients에 기록한다.

냉장고 재료가 없으면:

- ingredients는 반드시 null이다.

모든 kcal, 탄수화물, 단백질, 지방,
recommended_amount 값은 정수다.

Structured Output Schema를 따른다.
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
        logger.info(
            "Replacement meal OpenAI elapsed_seconds=%.2f",
            (
                perf_counter()
                - llm_start
            ),
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

    logger.info(
        "Replacement meal total elapsed_seconds=%.2f",
        (
            perf_counter()
            - total_start
        ),
    )

    return final_result
