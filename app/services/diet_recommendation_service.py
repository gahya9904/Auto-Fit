from typing import Any

from openai import AsyncOpenAI

from app.core.config import (
    get_settings,
)

from app.graphs.nodes.rag_node import (
    rag_node,
)

from app.schemas.recommendation import (
    DietRecommendationRequest,
    DietRecommendationResponse,
    ReplaceMealRequest,
    ReplaceMealResponse,
)

from app.services.diet_context_service import (
    build_diet_safety_tags,
)


# =========================================================
# Text / Refrigerator Utility
# =========================================================


def _normalize_text(
    value: str,
) -> str:
    return (
        value
        .strip()
        .lower()
    )


def _normalize_refrigerator_ingredients(
    ingredients: list[str] | None,
) -> list[str]:
    """
    Backend가 전달한 냉장고 재료명을 정리한다.
    """

    if not ingredients:
        return []

    result: list[str] = []

    for ingredient in ingredients:
        if not ingredient:
            continue

        cleaned = (
            ingredient.strip()
        )

        if (
            cleaned
            and cleaned not in result
        ):
            result.append(
                cleaned
            )

    return result


def _build_refrigerator_map(
    ingredients: list[str],
) -> dict[str, str]:
    """
    normalize된 재료명 -> 실제 입력 재료명.
    """

    result: dict[
        str,
        str,
    ] = {}

    for item in ingredients:
        normalized = (
            _normalize_text(
                item
            )
        )

        if not normalized:
            continue

        result[
            normalized
        ] = item

    return result


def _filter_used_refrigerator_ingredients(
    *,
    generated_ingredients: list[str] | None,
    refrigerator_ingredients: list[str],
) -> list[str] | None:
    """
    LLM이 반환한 ingredients를 서버에서 다시 검증한다.

    냉장고 재료가 없는 경우:
        ingredients = None

    냉장고 재료가 있는 경우:
        실제 냉장고 입력에 존재하는 재료만 허용
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

    result: list[str] = []

    for ingredient in generated_ingredients:
        normalized = (
            _normalize_text(
                ingredient
            )
        )

        actual_name = (
            refrigerator_map.get(
                normalized
            )
        )

        # 냉장고에 없는 재료는 ingredients에서 제거
        if actual_name is None:
            continue

        if actual_name not in result:
            result.append(
                actual_name
            )

    return result


# =========================================================
# RAG
# =========================================================


async def _get_diet_rag_context(
    metric_statuses: dict[str, str],
) -> list[dict[str, Any]]:
    """
    건강 상태에 해당하는 공식 가이드라인을 검색한다.
    """

    if not metric_statuses:
        return []

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
    LLM에 전달할 RAG 정보를 최소화한다.
    """

    safe_context: list[
        dict[str, Any]
    ] = []

    for item in rag_context[:8]:
        if not isinstance(
            item,
            dict,
        ):
            continue

        content = (
            item.get("content")
            or item.get(
                "content_preview"
            )
        )

        if not content:
            continue

        safe_context.append(
            {
                "content": content,
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
# Weekly Plan Ingredient Validation
# =========================================================


def _validate_weekly_plan_ingredients(
    *,
    response: DietRecommendationResponse,
    refrigerator_ingredients: list[str],
) -> DietRecommendationResponse:
    """
    7일 식단의 모든 Meal.ingredients를
    서버에서 다시 검증한다.
    """

    updated_days = []

    for day_plan in response.weekly_plan:
        meals = (
            day_plan.meals
        )

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
# Refrigerator Prompt
# =========================================================


def _build_refrigerator_instruction(
    refrigerator_ingredients: list[str],
) -> str:
    """
    냉장고 재료 존재 여부에 따라
    LLM 규칙을 구성한다.
    """

    if refrigerator_ingredients:
        return f"""
[냉장고 재료]
{refrigerator_ingredients}

냉장고 재료 활용 규칙:

- 위 재료를 이용해서 만들 수 있는 요리를 우선적으로 생성한다.
- 가능한 경우 냉장고 재료를 메뉴의 핵심 재료로 활용한다.
- 단, 알레르기 및 건강 안전 조건이 항상 냉장고 활용보다 우선한다.
- ingredients에는 해당 추천 메뉴에 실제 사용한 냉장고 재료 이름만 넣는다.
- ingredients는 전체 레시피 재료 목록이 아니다.
- 냉장고 입력에 없는 조미료 또는 보조 재료는 메뉴 구성에 사용할 수 있으나 ingredients에는 기록하지 않는다.
""".strip()

    return """
[냉장고 재료]
제공되지 않음.

냉장고 재료 활용 규칙:

- 건강 상태와 사용자 목표를 고려한 일반 맞춤 식단을 생성한다.
- 모든 메뉴의 ingredients는 반드시 null로 반환한다.
""".strip()


# =========================================================
# Diet Recommendation
# =========================================================


async def generate_diet_recommendation(
    request: DietRecommendationRequest,
) -> DietRecommendationResponse:
    """
    건강 상태, 사용자 목표, 알레르기,
    냉장고 재료를 기반으로 7일 식단을 생성한다.
    """

    settings = (
        get_settings()
    )

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

    instructions = """
너는 Auto-Fit의 개인 맞춤 식단 추천 AI다.

다음 우선순위를 반드시 지켜라.

1. 알레르기 및 명시적인 섭취 금지 조건
2. 사용자의 건강 상태와 안전성
3. 사용자의 건강/체중 관리 목표
4. 냉장고 재료 활용 가능성
5. 영양 균형
6. 현실적으로 먹을 수 있는 메뉴
7. 메뉴 다양성

중요 규칙:

- 의료 진단이나 치료 처방을 하지 않는다.
- 약물 관련 지시를 하지 않는다.
- 알레르기 재료는 절대 추천 메뉴에 사용하지 않는다.
- 제공되지 않은 건강 수치를 추측하지 않는다.
- metric_statuses의 상태값을 기준으로 건강 상태를 고려한다.

주간 식단 규칙:

- 정확히 7일 식단을 생성한다.
- monday, tuesday, wednesday, thursday,
  friday, saturday, sunday를 정확히 한 번씩 생성한다.
- 각 날짜에는 breakfast, lunch, dinner, snack을
  정확히 하나씩 생성한다.
- 같은 메뉴를 지나치게 반복하지 않는다.

각 메뉴에는 반드시 다음 정보를 생성한다.

1. menu_name
2. menu_description
3. estimated_calories_kcal
4. nutrition.carbohydrate_g
5. nutrition.protein_g
6. nutrition.fat_g
7. ingredients
8. guidance

영양 정보 규칙:

- estimated_calories_kcal은 메뉴 1인분 기준 예상 kcal이다.
- carbohydrate_g, protein_g, fat_g 역시
  메뉴 1인분 기준 예상 영양값이다.
- 정확한 임상 영양 처방값이라고 단정하지 않는다.
- 메뉴와 영양값 사이에 명백한 모순이 생기지 않도록 한다.

ingredients 규칙:

- ingredients는 전체 레시피 재료 목록이 아니다.
- 냉장고 재료가 제공된 경우,
  추천 메뉴에 실제 사용한 냉장고 재료 이름만 넣는다.
- 냉장고 재료가 제공되지 않은 경우,
  ingredients는 반드시 null이다.

냉장고 재료가 존재한다면
그 재료를 이용해서 만들 수 있는 요리를 우선적으로 생성한다.

단,
알레르기와 건강 안전 조건은
냉장고 활용보다 항상 우선한다.

출력은 지정된 Structured Output Schema를 따른다.
""".strip()

    prompt = f"""
[건강 상태 분류]
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

위 조건을 종합해서
사용자가 실제로 실천할 수 있는 7일 식단을 생성하라.
"""

    response = await client.responses.parse(
        model=settings.openai_model,
        instructions=instructions,
        input=prompt,
        reasoning={
            "effort": "minimal"
        },
        text_format=DietRecommendationResponse,
        max_output_tokens=6500,
    )

    result = (
        response.output_parsed
    )

    if result is None:
        raise RuntimeError(
            "Diet recommendation output is empty"
        )

    # 냉장고 재료 정보는 LLM 결과를 그대로 신뢰하지 않고
    # 실제 입력값 기준으로 다시 검증한다.
    result = (
        _validate_weekly_plan_ingredients(
            response=result,
            refrigerator_ingredients=(
                refrigerator_ingredients
            ),
        )
    )

    return result


# =========================================================
# Replace Meal
# =========================================================


async def generate_replacement_meal(
    request: ReplaceMealRequest,
) -> ReplaceMealResponse:
    """
    특정 식사 슬롯 하나의 메뉴를 새로 생성한다.
    """

    settings = (
        get_settings()
    )

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

우선순위:

1. 알레르기 및 명시적인 섭취 금지 조건
2. 건강 상태와 안전성
3. 사용자 목표
4. 냉장고 재료 활용
5. 기존 메뉴와 다른 메뉴
6. 영양 균형
7. 현실적인 식사

규칙:

- 현재 메뉴와 다른 메뉴를 생성한다.
- 가능하면 기존 메뉴와 주재료 또는 조리 방식도 다르게 한다.
- 의료 진단이나 치료 지시를 하지 않는다.
- 알레르기 재료는 절대 사용하지 않는다.

새 메뉴에는 반드시 다음 값을 포함한다.

- menu_name
- menu_description
- estimated_calories_kcal
- nutrition.carbohydrate_g
- nutrition.protein_g
- nutrition.fat_g
- ingredients
- guidance

estimated_calories_kcal 및 영양소는
메뉴 1인분 기준 예상값이다.

ingredients는 전체 레시피 재료 목록이 아니다.

냉장고 재료가 존재하는 경우:
- 그 재료를 활용할 수 있는 메뉴를 우선 생성한다.
- 실제 새 메뉴에 사용한 냉장고 재료 이름만
  ingredients에 기록한다.

냉장고 재료가 없는 경우:
- ingredients는 반드시 null이다.

출력은 지정된 Structured Output Schema를 따른다.
""".strip()

    prompt = f"""
[교체 대상]
요일: {request.target_day}
식사 유형: {request.target_meal}

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

[추가 사용자 입력]
{additional_input}

{refrigerator_instruction}

[검증된 건강 가이드라인 RAG]
{safe_rag_context}

현재 메뉴와 다른
새로운 메뉴 하나를 생성하라.
"""

    response = await client.responses.parse(
        model=settings.openai_model,
        instructions=instructions,
        input=prompt,
        reasoning={
            "effort": "minimal"
        },
        text_format=ReplaceMealResponse,
        max_output_tokens=1800,
    )

    result = (
        response.output_parsed
    )

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

    result = (
        result.model_copy(
            update={
                "meal": validated_meal
            }
        )
    )

    return result