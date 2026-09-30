import logging
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
    """
    LLM 결과 중 실제 냉장고에 존재하는
    재료만 ingredients에 남긴다.
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

    공백/대소문자는 무시한다.
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


def _has_duplicate_menu_names(
    response: DietRecommendationResponse,
) -> bool:
    return bool(
        _find_duplicate_menu_names(
            response
        )
    )


# =========================================================
# RAG
# =========================================================


async def _get_diet_rag_context(
    metric_statuses: dict[str, str],
) -> list[dict[str, Any]]:
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
                "content": (
                    content
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

냉장고 활용 규칙:

- 위 냉장고 재료를 활용할 수 있는 메뉴를 우선적으로 고려한다.
- 하지만 모든 끼니에 냉장고 재료를 반드시 넣을 필요는 없다.
- 냉장고 재료 때문에 7일 식단의 메뉴 다양성이 지나치게 제한되어서는 안 된다.
- 동일한 냉장고 재료가 연속된 여러 끼니에서 주재료로 반복되지 않도록 한다.
- 같은 냉장고 재료라도 조리법과 메뉴 형태를 다양하게 구성한다.
- 필요하다면 일반적인 식재료를 추가하여 새로운 메뉴를 구성할 수 있다.
- 알레르기와 건강 안전 조건이 냉장고 활용보다 항상 우선한다.

ingredients 규칙:

- ingredients는 전체 레시피 재료 목록이 아니다.
- 실제 해당 메뉴에 사용된 냉장고 재료만 기록한다.
- 냉장고에 없는 일반 재료나 조미료는 ingredients에 넣지 않는다.

각 ingredients 항목에는 반드시:

- name
- recommended_amount
- unit
- carbohydrate_g
- protein_g
- fat_g
- estimated_calories_kcal

를 포함한다.

recommended_amount와 모든 영양값은 정수로 반환한다.

재료별 영양정보는
recommended_amount만큼 섭취했을 때의
예상 영양정보이다.
""".strip()

    return """
[냉장고 재료]
제공되지 않음.

규칙:

- 냉장고 재료가 없더라도 메뉴 다양성을 적극적으로 확보한다.
- 일반적인 식재료를 이용하여 현실적으로 먹을 수 있는 식단을 구성한다.
- 7일 동안 가능한 한 서로 다른 메뉴를 추천한다.
- 모든 메뉴의 ingredients는 반드시 null이다.
- 메뉴 총 kcal와 탄수화물/단백질/지방은 정상적으로 생성한다.
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
    retry_duplicates: (
        list[str]
        | None
    ) = None,
) -> DietRecommendationResponse:
    """
    실제 OpenAI Structured Output 호출.
    """

    diversity_retry_instruction = ""

    if retry_duplicates:
        diversity_retry_instruction = f"""
[이전 생성 결과에서 중복된 메뉴]
{retry_duplicates}

이전 결과에 동일한 메뉴가 반복되었다.

이번에는 위 메뉴를 포함한 중복이 다시 발생하지 않도록
28개 식사 슬롯의 메뉴명을 모두 다르게 구성하라.

이름만 살짝 바꾼 사실상 동일한 메뉴도 피하라.
""".strip()

    instructions = """
너는 Auto-Fit의 개인 맞춤 식단 추천 AI다.

추천 우선순위:

1. 알레르기 및 명시적 섭취 제한
2. 건강 상태 및 안전성
3. 사용자의 목표
4. 냉장고 재료 활용
5. 영양 균형
6. 메뉴 다양성
7. 현실적인 조리 및 섭취 가능성


건강 규칙:

- 의료 진단이나 치료 처방을 하지 않는다.
- 알레르기 재료는 절대 사용하지 않는다.
- 제공되지 않은 건강 수치를 추측하지 않는다.
- metric_statuses를 기준으로 건강 상태를 고려한다.


주간 식단 규칙:

- 정확히 7일을 생성한다.
- monday부터 sunday까지 정확히 한 번씩 생성한다.
- 매일 breakfast, lunch, dinner, snack을 정확히 하나씩 생성한다.
- 총 28개의 식사 슬롯을 생성한다.


메뉴 다양성 규칙:

- 7일 전체에서 동일한 메뉴명을 반복하지 않는다.
- 같은 주재료가 연속적으로 지나치게 반복되지 않도록 한다.
- 같은 조리법도 연속적으로 지나치게 반복하지 않는다.
- 볶음, 구이, 찜, 국, 찌개, 샐러드, 덮밥,
  비빔밥, 샌드위치, 죽, 수프, 오믈렛 등
  다양한 메뉴 형태를 활용한다.
- 동일한 음식의 이름만 바꾼 유사 메뉴는 피한다.
- breakfast, lunch, dinner, snack의 특성에 맞게 메뉴를 구성한다.


냉장고 재료 규칙:

- 냉장고 재료가 있으면 우선 활용한다.
- 단, 모든 끼니에 동일한 냉장고 재료를 강제로 사용하지 않는다.
- 냉장고 재료 때문에 메뉴 다양성이 지나치게 제한되지 않도록 한다.
- 필요하면 일반적인 추가 식재료를 사용할 수 있다.
- ingredients에는 실제 냉장고 재료 중 해당 메뉴에 사용된 재료만 기록한다.
- 냉장고 재료가 없는 경우 ingredients는 반드시 null이다.


메뉴 출력 규칙:

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


image_prompt 규칙:

- image_prompt는 Stable Diffusion 음식 이미지 생성을 위한 영문 프롬프트다.
- 반드시 영어로 작성한다.
- 한국어 menu_name을 단순 직역하는 것에 그치지 않는다.
- 음식의 실제 외형을 구체적으로 묘사한다.
- 주요 식재료의 색상과 형태가 이미지에서 식별되도록 작성한다.
- 조리 방식을 명확하게 표현한다.
- 실제 메뉴에 포함되지 않은 육류나 주요 식재료가 나타나지 않도록 작성한다.

예:
두부가 사용된다면:
"clearly visible white tofu cubes"

브로콜리가 사용된다면:
"fresh green broccoli florets"

계란볶음이라면:
"soft yellow scrambled egg"

고기가 없는 메뉴라면:
"no pork, no beef, no chicken, no meat"

- 1인분 음식이 접시 또는 그릇에 담긴 모습으로 설명한다.
- realistic professional food photography 스타일을 사용한다.
- natural lighting, realistic food texture 등의 표현을 사용할 수 있다.
- 사람, 손, 얼굴, 글자, 워터마크, 로고는 포함하지 않는다.
- 건강 수치, 개인정보, 칼로리 숫자 등은 image_prompt에 포함하지 않는다.
- image_prompt는 너무 길지 않은 영어 1~3문장으로 작성한다.


숫자 규칙:

- estimated_calories_kcal은 정수
- carbohydrate_g는 정수
- protein_g는 정수
- fat_g는 정수
- ingredients 내부 영양정보도 정수
- ingredients.recommended_amount도 정수


영양정보 규칙:

- 메뉴 전체 영양정보는 1인분 기준 예상값이다.
- ingredients 영양정보는 해당 recommended_amount 기준 예상값이다.
- ingredients는 냉장고 활용 재료만 포함하기 때문에
  ingredients 영양정보의 합과 메뉴 전체 영양정보는 다를 수 있다.


출력은 Structured Output Schema를 따른다.
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

{diversity_retry_instruction}

위 정보를 바탕으로
건강 조건을 만족하면서도
7일 동안 메뉴가 다양하게 구성된
실천 가능한 식단을 생성하라.
"""

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
            max_output_tokens=10000,
        )

    except Exception:
        logger.exception(
            "Weekly diet OpenAI generation failed"
        )
        raise

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
    # 1차 생성
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
    # 메뉴 중복 검사
    # -----------------------------------------------------

    duplicates = (
        _find_duplicate_menu_names(
            result
        )
    )

    # -----------------------------------------------------
    # 중복 존재 시 1회 재생성
    # -----------------------------------------------------

    if duplicates:
        retry_result = (
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
                retry_duplicates=(
                    duplicates
                ),
            )
        )

        result = retry_result

    # -----------------------------------------------------
    # 냉장고 재료 후처리 검증
    # -----------------------------------------------------

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


image_prompt 규칙:

- Stable Diffusion 음식 이미지 생성용 영어 프롬프트로 작성한다.
- 메뉴명을 단순 번역하는 것이 아니라 음식 외형을 구체적으로 설명한다.
- 주요 식재료의 색상, 형태, 조리 방식을 표현한다.
- 메뉴에 포함되지 않은 주요 육류나 재료는 나타나지 않도록 한다.
- 고기가 없는 음식이면 no pork, no beef, no chicken, no meat 등을 사용할 수 있다.
- realistic professional food photography 스타일로 작성한다.
- 사람, 손, 얼굴, 글자, 워터마크, 로고는 포함하지 않는다.
- 건강정보와 칼로리 숫자는 image_prompt에 넣지 않는다.
- 영어 1~3문장으로 작성한다.


냉장고 재료가 있는 경우:

- 냉장고 재료를 활용할 수 있는 메뉴를 우선 고려한다.
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
        max_output_tokens=1800,
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

    return result.model_copy(
        update={
            "meal": (
                validated_meal
            )
        }
    )
