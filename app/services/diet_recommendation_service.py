import json

from openai import AsyncOpenAI

from app.core.config import get_settings
from app.graphs.nodes.rag_node import rag_node

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
# System Instructions
# =========================================================

SYSTEM_INSTRUCTIONS = """
너는 Auto-Fit 헬스케어 애플리케이션의 개인 맞춤 식단 추천 AI다.

반드시 제공된 조건과 검증된 공식 RAG 자료만 이용하여
일반적인 건강관리 목적의 식단을 구성한다.

모든 판단에는 다음 우선순위를 반드시 적용한다.

1순위: 안전성
2순위: 건강 상태
3순위: 사용자 목표
4순위: Auto-Fit 종합 건강 전략
5순위: 영양 균형
6순위: 냉장고 재료 활용
7순위: 메뉴 다양성 및 현실성

하위 우선순위는 상위 우선순위를 위반할 수 없다.

additional_input에는 다음과 같은 서로 다른 사용자 입력이
구분되지 않은 상태로 함께 포함될 수 있다.

- 섭취하지 않는 음식
- 식단 제한
- 선호하는 식단
- 선호하는 음식
- 싫어하는 음식
- 기타 식사 관련 요청

따라서 additional_input을 문맥에 따라 해석한다.

예:

"먹지 않음"
"섭취하지 않음"
"제외"
"금지"
"먹을 수 없음"

과 같은 명시적 표현은 강한 제외 조건으로 취급한다.

"싫어함"
"안 좋아함"
"선호하지 않음"

과 같은 표현은 가능하면 제외하는 선호 조건으로 취급한다.

"선호함"
"좋아함"
"원함"
"고단백 식단"
"채식 위주"

등은 가능한 범위에서 반영하는 선호 조건으로 취급한다.

중요:
additional_input의 애매한 표현을 알레르기로 추론하지 않는다.
알레르기는 반드시 food_allergens에 명시된 값만 알레르기로 취급한다.

규칙:
- 의료 진단을 하지 않는다.
- 질병이 있다고 단정하지 않는다.
- 약물이나 의료 치료 변경을 권고하지 않는다.
- 원본 건강 수치를 추측하지 않는다.
- 개인정보나 사용자 식별정보를 추론하지 않는다.
- 극단적인 저열량 식단이나 장기 단식을 권장하지 않는다.
- 특정 영양제를 치료 목적으로 권장하지 않는다.
- 건강 안전 조건과 사용자 목표가 충돌하면 건강 안전 조건을 우선한다.
- food_allergens에 포함된 식품은 어떠한 경우에도 식단에 포함하지 않는다.
- 냉장고 재료에 알레르기 식품이 있더라도 절대 사용하지 않는다.
- sources에는 실제 rag_context에 존재하는 공식 자료만 사용한다.
- 사용자에게 "원본 검사 수치가 없다"고 표현하지 않는다.
""".strip()


# =========================================================
# OpenAI
# =========================================================


def _get_openai_client() -> AsyncOpenAI:
    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not configured."
        )

    return AsyncOpenAI(
        api_key=settings.openai_api_key
    )


# =========================================================
# Utility
# =========================================================


def _clean_list(
    values: list[str] | None,
    max_item_length: int = 50,
) -> list[str]:
    if not values:
        return []

    result: list[str] = []

    for value in values:
        cleaned = value.strip()

        if not cleaned:
            continue

        result.append(
            cleaned[:max_item_length]
        )

    return result


def _normalize_additional_input(
    value: str | list[str] | None,
) -> list[str]:
    """
    Backend의 기타 입력값을 하나의 일관된 리스트 형태로 정리한다.

    입력 가능 형태:

    null

    "가지 싫어함, 고단백 식단 선호"

    [
        "가지 싫어함",
        "고단백 식단 선호"
    ]
    """

    if value is None:
        return []

    if isinstance(value, str):
        cleaned = value.strip()

        if not cleaned:
            return []

        return [
            cleaned[:500]
        ]

    result: list[str] = []

    for item in value:
        cleaned = item.strip()

        if not cleaned:
            continue

        result.append(
            cleaned[:200]
        )

    return result[:30]


def _build_food_exclusions(
    allergens: list[str] | None,
) -> list[str]:
    """
    명시적으로 전달된 알레르기만
    절대 제외 조건으로 변환한다.
    """

    cleaned = _clean_list(
        allergens
    )

    return [
        f"exclude:{food}"
        for food in cleaned
    ]


def _build_safe_rag_context(
    rag_context: list[dict],
) -> list[dict]:
    """
    외부 LLM에 필요한 공식 RAG 내용만 전달한다.
    """

    safe_context: list[dict] = []

    for item in rag_context:
        content = str(
            item.get(
                "content",
                "",
            )
        )

        safe_context.append(
            {
                "content": content[:2000],
                "source_org": item.get(
                    "source_org"
                ),
                "title": item.get(
                    "title"
                ),
                "topic": item.get(
                    "topic"
                ),
            }
        )

    return safe_context


async def _get_diet_rag_context(
    metric_statuses: dict[str, str],
) -> list[dict]:
    """
    기존 Status-aware RAG pipeline을 재사용한다.
    """

    rag_result = await rag_node(
        {
            "merged_analysis": {
                "metric_statuses": (
                    metric_statuses
                )
            },
            "warnings": [],
        }
    )

    rag_context = rag_result.get(
        "rag_context",
        [],
    )

    return _build_safe_rag_context(
        rag_context
    )


# =========================================================
# Weekly Diet Recommendation
# =========================================================


async def generate_diet_recommendation(
    request: DietRecommendationRequest,
) -> DietRecommendationResponse:
    settings = get_settings()

    # =====================================================
    # 1. 내부 건강 상태
    # =====================================================

    metric_statuses = request.metric_statuses

    # =====================================================
    # 2. 건강상태 -> 안전한 일반화 Tag
    # =====================================================

    safety_tags = build_diet_safety_tags(
        metric_statuses
    )

    # =====================================================
    # 3. 공식 RAG
    # =====================================================

    safe_rag_context = await _get_diet_rag_context(
        metric_statuses
    )

    # =====================================================
    # 4. 알레르기
    # =====================================================

    food_exclusions = _build_food_exclusions(
        request.food_allergens
    )

    # =====================================================
    # 5. 통합 기타 입력
    # =====================================================

    additional_input = _normalize_additional_input(
        request.additional_input
    )

    # =====================================================
    # 6. 냉장고
    # =====================================================

    refrigerator_ingredients = _clean_list(
        request.refrigerator_ingredients
    )

    # =====================================================
    # 7. 외부 LLM payload
    #
    # raw 건강 수치는 전달하지 않는다.
    # =====================================================

    payload = {
        "priority_1_safety": {
            "food_exclusions": (
                food_exclusions
            ),
        },

        "priority_2_health": {
            "diet_safety_tags": (
                safety_tags
            ),
        },

        "priority_3_goal": {
            "goal_type": (
                request.goal_type
            ),
        },

        "additional_input": (
            additional_input
        ),

        "refrigerator_ingredients": (
            refrigerator_ingredients
        ),

        "rag_context": (
            safe_rag_context
        ),
    }

    client = _get_openai_client()

    response = await client.responses.parse(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
다음 정보를 기반으로 Auto-Fit 개인 맞춤 주간 식단을 생성하세요.

반드시 월요일부터 일요일까지 정확히 7일을 생성합니다.

각 날짜에는 반드시 다음 4개의 식사가 모두 있어야 합니다.

- breakfast
- lunch
- dinner
- snack

snack은 하루에 정확히 1회만 생성합니다.

==================================================
1순위 - 안전성
==================================================

food_exclusions는 명시적으로 전달된 알레르기 식품입니다.

- food_exclusions에 포함된 식품은 절대 사용하지 마세요.
- 해당 알레르기 식품이 명백히 포함된 메뉴도 추천하지 마세요.
- 냉장고 재료에 포함되어 있어도 절대 사용하지 마세요.
- 다른 모든 사용자 선호보다 알레르기 안전성이 우선입니다.

additional_input 안에 음식 제외 요청이 있을 수도 있습니다.

예:

"돼지고기 먹지 않음"
"유제품 제외"
"밀가루를 먹지 않음"

처럼 명시적으로 섭취하지 않는다고 표현된 조건은
강한 제외 조건으로 처리하세요.

단,
additional_input의 내용을 임의로 알레르기라고 판단하지 마세요.

==================================================
2순위 - 건강 상태
==================================================

diet_safety_tags를 반영하세요.

weight_management:
- 지속 가능한 에너지 조절
- 포만감 높은 식사

sodium_caution:
- 나트륨 과다 섭취를 피하는 방향

glucose_management:
- 첨가당과 정제 탄수화물 과다 섭취를 피하는 방향

lipid_management:
- 포화지방과 과도한 고지방 식품을 줄이는 방향

body_fat_management:
- 식사의 에너지 밀도와 포만감을 고려

muscle_mass_support:
- 식사마다 적절한 단백질 공급원을 고려

건강 tag를 질병명이나 진단명으로 변환하지 마세요.

==================================================
3순위 - 사용자 목표
==================================================

goal_type을 전체 식단 전략에 반영하세요.

예:

weight_loss / 체중 감량:
- 지속 가능한 에너지 조절
- 포만감 유지

muscle_gain / 근육 증가:
- 적절한 단백질 공급
- 균형 잡힌 에너지 공급

general_health / 건강 관리:
- 전체적인 영양 균형
- 다양한 식품 구성

goal_type이 자연어 문장이어도 의미를 이해하여 반영하세요.

단, 안전 조건보다 목표가 우선해서는 안 됩니다.

==================================================
4순위 - Auto-Fit 종합 전략
==================================================

하나의 건강 tag만 기준으로 식단을 만들지 마세요.

다음을 종합적으로 고려하세요.

- 안전성
- 건강상태
- 사용자 목표
- additional_input
- 냉장고 재료

strategy에는 전체적인 Auto-Fit 식단 전략을
간결하게 작성하세요.

==================================================
5순위 - 영양 균형
==================================================

nutrition_balance에 다음을 모두 작성하세요.

- energy_strategy
- carbohydrate_strategy
- protein_strategy
- fat_strategy

정확한 의료 처방용 kcal 또는 영양소 g 값을
임의 계산하지 마세요.

각 끼니에서는 가능한 범위에서:

- 적절한 탄수화물 공급원
- 단백질 공급원
- 채소 또는 식이섬유
- 적절한 지방 공급원

을 균형 있게 고려하세요.

==================================================
6순위 - 냉장고 재료
==================================================

refrigerator_ingredients가 있다면
안전 조건을 위반하지 않는 범위에서 우선 활용하세요.

모든 냉장고 재료를 반드시 사용할 필요는 없습니다.

필요한 경우 일반적으로 구하기 쉬운 식품을
추가할 수 있습니다.

냉장고 재료 활용보다 안전성과 영양 균형이 우선입니다.

==================================================
7순위 - 통합 기타 입력 해석
==================================================

additional_input에는 서로 다른 종류의 요청이
구분되지 않은 상태로 들어옵니다.

따라서 문맥을 보고 해석하세요.

명시적 제외 표현:

- 먹지 않음
- 섭취하지 않음
- 제외
- 먹을 수 없음

→ 해당 식품을 추천하지 않습니다.

비선호 표현:

- 싫어함
- 안 좋아함
- 선호하지 않음

→ 가능한 한 해당 식품을 피합니다.

선호 표현:

- 좋아함
- 선호함
- 원함
- 고단백
- 저염식
- 채식 위주

→ 안전성과 건강 상태에 위배되지 않는 범위에서 반영합니다.

문맥이 애매하면 강한 제한 조건을 임의로 만들지 마세요.

==================================================
메뉴 생성 규칙
==================================================

단순 재료 목록을 추천하지 마세요.

사용자가 실제로 먹을 수 있는
완성된 음식 또는 요리 형태로 추천하세요.

menu_name에는 구체적인 음식명을 작성하세요.

잘못된 예:

"닭가슴살"
"두부"
"계란, 브로콜리, 양배추"

올바른 예:

"닭가슴살 현미 채소덮밥"
"두부 버섯 된장구이"
"브로콜리 채소 오믈렛"

menu_description에는
해당 음식을 어떤 형태로 조리하는지
짧은 한 문장으로 설명하세요.

menu_description은 120자 이하로 작성하세요.

ingredients에는
해당 메뉴를 만드는 주요 재료만 작성하세요.

냉장고 재료가 있다면
가능한 한 완성된 음식 형태로 조합하세요.

한 끼는 단순 식재료 나열이 아니라
실제 식사 메뉴로 완성되어야 합니다.

==================================================
guidance 규칙
==================================================

guidance는 반드시:

- 한 문장
- 80자 이하
- 최대한 간단하게
- 핵심 행동 지침 한 가지만

작성하세요.

예:

"소스는 적게 사용하세요."
"채소를 먼저 드세요."
"무가당 제품을 선택하세요."

긴 영양학 설명을 넣지 마세요.

==================================================
7일 식단 규칙
==================================================

weekly_plan에는 정확히 다음 7개 요일을
각각 한 번씩 포함하세요.

1. monday
2. tuesday
3. wednesday
4. thursday
5. friday
6. saturday
7. sunday

각 날짜에는 반드시:

breakfast
lunch
dinner
snack

이 모두 존재해야 합니다.

7일 동안 같은 메뉴의 반복을 최소화하세요.

아침, 점심, 저녁, 간식의 구성도
가능한 한 다양하게 만드세요.

한국에서 일반적으로 구하기 쉬운 식재료와
현실적인 조리 방법을 우선하세요.

==================================================
출력 규칙
==================================================

dietary_principles는 최대 6개 작성하세요.

foods_to_prioritize는 최대 8개 작성하세요.

foods_to_limit는 최대 8개 작성하세요.

cautions는 최대 5개 작성하세요.

sources에는 실제 rag_context에 존재하는
자료만 사용하세요.

"원본 검사 수치가 없다"는 표현은
사용하지 마세요.

입력 데이터:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
""".strip(),
        text_format=(
            DietRecommendationResponse
        ),
        max_output_tokens=6000,
    )

    parsed = response.output_parsed

    if parsed is None:
        raise RuntimeError(
            "주간 식단 구조화 응답을 생성하지 못했습니다."
        )

    return parsed


# =========================================================
# Replace Single Meal
# =========================================================


async def generate_replacement_meal(
    request: ReplaceMealRequest,
) -> ReplaceMealResponse:
    settings = get_settings()

    # =====================================================
    # 1. 내부 건강 상태
    # =====================================================

    metric_statuses = request.metric_statuses

    # =====================================================
    # 2. 일반화 건강 Tag
    # =====================================================

    safety_tags = build_diet_safety_tags(
        metric_statuses
    )

    # =====================================================
    # 3. RAG
    # =====================================================

    safe_rag_context = await _get_diet_rag_context(
        metric_statuses
    )

    # =====================================================
    # 4. 알레르기
    # =====================================================

    food_exclusions = _build_food_exclusions(
        request.food_allergens
    )

    # =====================================================
    # 5. 기타 입력
    # =====================================================

    additional_input = _normalize_additional_input(
        request.additional_input
    )

    # =====================================================
    # 6. 냉장고
    # =====================================================

    refrigerator_ingredients = _clean_list(
        request.refrigerator_ingredients
    )

    # =====================================================
    # 7. 현재 메뉴
    # =====================================================

    current_ingredients = _clean_list(
        request.current_ingredients
    )

    # =====================================================
    # 8. Payload
    # =====================================================

    payload = {
        "target": {
            "day": (
                request.target_day
            ),
            "meal_type": (
                request.target_meal
            ),
        },

        "current_meal": {
            "menu_name": (
                request.current_menu_name
            ),
            "ingredients": (
                current_ingredients
            ),
        },

        "priority_1_safety": {
            "food_exclusions": (
                food_exclusions
            ),
        },

        "priority_2_health": {
            "diet_safety_tags": (
                safety_tags
            ),
        },

        "priority_3_goal": {
            "goal_type": (
                request.goal_type
            ),
        },

        "additional_input": (
            additional_input
        ),

        "refrigerator_ingredients": (
            refrigerator_ingredients
        ),

        "rag_context": (
            safe_rag_context
        ),
    }

    client = _get_openai_client()

    response = await client.responses.parse(
        model=settings.openai_model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=f"""
사용자가 기존 주간 식단의 특정 식사를
다른 메뉴로 변경하려고 합니다.

target.day와 target.meal_type에 해당하는
식사 하나만 새로운 메뉴로 추천하세요.

==================================================
기존 메뉴와의 차이
==================================================

- current_meal.menu_name과 동일한 메뉴를 다시 추천하지 마세요.
- current_meal.ingredients와 완전히 같은 구성을 다시 추천하지 마세요.
- 가능하면 기존 메뉴와 다른 주재료 또는 조리방식을 사용하세요.

단,
메뉴 다양성보다 안전 조건이 항상 우선입니다.

==================================================
안전 조건
==================================================

food_exclusions에는 명시적인 알레르기 식품만 들어 있습니다.

해당 식품은 절대 사용하지 마세요.

additional_input에:

"먹지 않음"
"제외"
"섭취하지 않음"

등의 명시적 제외 요청이 있다면
해당 식품도 추천하지 마세요.

additional_input의 애매한 문장을
알레르기로 추론하지 마세요.

==================================================
사용자 선호
==================================================

additional_input에는 섭취 제한,
싫어하는 음식, 선호 식단 등이
하나의 입력으로 섞여 있습니다.

문맥에 따라 다음처럼 해석하세요.

명시적 제외
→ 사용하지 않음

싫어함 / 비선호
→ 가능한 한 피함

선호함 / 좋아함 / 원하는 식단
→ 가능한 범위에서 반영

==================================================
건강 상태와 목표
==================================================

diet_safety_tags와 goal_type을 함께 고려하세요.

건강 안전 조건이 사용자 선호보다 우선입니다.

원본 건강 수치는 추측하지 마세요.

==================================================
냉장고 재료
==================================================

refrigerator_ingredients가 있다면
안전 조건에 위배되지 않는 재료를 우선 활용하세요.

단,
기존 메뉴와 완전히 동일해지지 않도록 구성하세요.

==================================================
식사 종류
==================================================

target.meal_type이 breakfast이면
현실적인 아침 식사로 추천하세요.

target.meal_type이 lunch이면
현실적인 점심 식사로 추천하세요.

target.meal_type이 dinner이면
현실적인 저녁 식사로 추천하세요.

target.meal_type이 snack이면
한 끼 식사가 아니라
하루 1회 먹을 수 있는 현실적인 간식으로 추천하세요.

==================================================
메뉴 출력
==================================================

menu_name은 실제 완성된 음식명으로 작성하세요.

menu_description은 조리 형태를
120자 이하의 짧은 한 문장으로 작성하세요.

ingredients에는 주요 재료를 작성하세요.

guidance는:

- 한 문장
- 80자 이하
- 핵심 행동 지침 하나

만 작성하세요.

sources에는 실제 rag_context에 있는
출처만 사용하세요.

입력 데이터:

{json.dumps(
    payload,
    ensure_ascii=False,
)}
""".strip(),
        text_format=(
            ReplaceMealResponse
        ),
        max_output_tokens=1800,
    )

    parsed = response.output_parsed

    if parsed is None:
        raise RuntimeError(
            "대체 식단 구조화 응답을 생성하지 못했습니다."
        )

    return parsed