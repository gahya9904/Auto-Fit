from app.schemas.chat import (
    ChatRequest,
    ChatResponse,
)

from app.schemas.recommendation import (
    ReplaceMealRequest,
)

from app.services.chat_intent_service import (
    classify_chat_intent,
)

from app.services.chat_answer_service import (
    answer_diet_question,
    answer_exercise_question,
    answer_general_chat,
    answer_health_question,
)

from app.services.diet_recommendation_service import (
    generate_replacement_meal,
)


# =========================================================
# Utility
# =========================================================


def _extract_current_meal(
    diet_summary: dict | None,
    target_day: str,
    target_meal: str,
) -> tuple[str | None, list[str]]:
    """
    Backend가 전달한 주간 식단에서
    지정된 요일/식사 메뉴를 찾는다.
    """

    if not diet_summary:
        return None, []

    weekly_plan = diet_summary.get(
        "weekly_plan",
        [],
    )

    if not isinstance(
        weekly_plan,
        list,
    ):
        return None, []

    for day_item in weekly_plan:

        if not isinstance(
            day_item,
            dict,
        ):
            continue

        if day_item.get(
            "day"
        ) != target_day:
            continue

        meals = day_item.get(
            "meals",
            {},
        )

        if not isinstance(
            meals,
            dict,
        ):
            return None, []

        meal = meals.get(
            target_meal
        )

        if not isinstance(
            meal,
            dict,
        ):
            return None, []

        menu_name = meal.get(
            "menu_name"
        )

        ingredients = meal.get(
            "ingredients",
            [],
        )

        if not isinstance(
            ingredients,
            list,
        ):
            ingredients = []

        return (
            menu_name,
            ingredients,
        )

    return None, []


# =========================================================
# Chat Orchestrator
# =========================================================


async def process_chat(
    request: ChatRequest,
) -> ChatResponse:
    """
    Auto-Fit Chat Orchestrator.

    Backend에서 전달한:
    - 현재 사용자 메시지
    - 최근 대화 history
    - 건강/운동/식단 context

    를 이용하여 적절한 기능으로 라우팅한다.
    """

    # =====================================================
    # 1. Intent Classification
    #
    # 현재 메시지뿐 아니라 최근 history도 함께 사용한다.
    # =====================================================

    intent_result = await classify_chat_intent(
        message=request.content,
        history=request.history,
    )

    intent = intent_result.intent

    context = request.context

    # =====================================================
    # 2. Safe Context
    # =====================================================

    metric_statuses = (
        context.metric_statuses
        if context is not None
        else {}
    )

    # =====================================================
    # 3. Health Question
    # =====================================================

    if intent == "health_question":

        answer = await answer_health_question(
            message=request.content,
            metric_statuses=metric_statuses,
        )

        return ChatResponse(
            intent=intent,
            message=answer,
            action="health_rag",
        )

    # =====================================================
    # 4. Exercise Question
    # =====================================================

    if intent == "exercise_question":

        exercise_summary = (
            context.exercise_summary
            if context is not None
            else None
        )

        answer = await answer_exercise_question(
            message=request.content,
            metric_statuses=metric_statuses,
            exercise_summary=exercise_summary,
        )

        return ChatResponse(
            intent=intent,
            message=answer,
            action="exercise_context",
        )

    # =====================================================
    # 5. Diet Question
    # =====================================================

    if intent == "diet_question":

        diet_summary = (
            context.diet_summary
            if context is not None
            else None
        )

        answer = await answer_diet_question(
            message=request.content,
            metric_statuses=metric_statuses,
            diet_summary=diet_summary,
        )

        return ChatResponse(
            intent=intent,
            message=answer,
            action="diet_context",
            target_day=(
                intent_result.target_day
            ),
            target_meal=(
                intent_result.target_meal
            ),
        )

    # =====================================================
    # 6. Diet Replace
    # =====================================================

    if intent == "diet_replace_request":

        target_day = (
            intent_result.target_day
        )

        target_meal = (
            intent_result.target_meal
        )

        # -------------------------------------------------
        # 요일이 아직 없음
        # -------------------------------------------------

        if not target_day:
            return ChatResponse(
                intent=intent,
                message=(
                    "어느 요일의 식사를 변경할지 알려주세요."
                ),
                action="need_target_day",
                target_day=None,
                target_meal=target_meal,
            )

        # -------------------------------------------------
        # 식사 종류가 아직 없음
        # -------------------------------------------------

        if not target_meal:
            return ChatResponse(
                intent=intent,
                message=(
                    "아침, 점심, 저녁, 간식 중 "
                    "어떤 식사를 변경할지 알려주세요."
                ),
                action="need_target_meal",
                target_day=target_day,
                target_meal=None,
            )

        # -------------------------------------------------
        # Backend context 없음
        # -------------------------------------------------

        if context is None:
            return ChatResponse(
                intent=intent,
                message=(
                    "현재 저장된 식단 정보가 필요합니다."
                ),
                action="need_diet_context",
                target_day=target_day,
                target_meal=target_meal,
            )

        # -------------------------------------------------
        # 기존 메뉴 확인
        # -------------------------------------------------

        current_menu_name, current_ingredients = (
            _extract_current_meal(
                diet_summary=context.diet_summary,
                target_day=target_day,
                target_meal=target_meal,
            )
        )

        if current_menu_name is None:
            return ChatResponse(
                intent=intent,
                message=(
                    "변경하려는 기존 식단을 찾지 못했습니다."
                ),
                action="meal_not_found",
                target_day=target_day,
                target_meal=target_meal,
            )

        # -------------------------------------------------
        # 기존 식단 교체 서비스 재사용
        # -------------------------------------------------

        replacement_request = ReplaceMealRequest(
            metric_statuses=(
                context.metric_statuses
            ),

            target_day=target_day,

            target_meal=target_meal,

            current_menu_name=(
                current_menu_name
            ),

            current_ingredients=(
                current_ingredients
            ),

            food_allergens=(
                context.food_allergens
            ),

            goal_type=(
                context.goal_type
            ),

            additional_input=(
                context.additional_input
            ),

            refrigerator_ingredients=(
                context.refrigerator_ingredients
            ),
        )

        replacement = (
            await generate_replacement_meal(
                replacement_request
            )
        )

        new_menu_name = (
            replacement.meal.menu_name
        )

        return ChatResponse(
            intent=intent,

            message=(
                f"{target_day} {target_meal} 메뉴를 "
                f"'{new_menu_name}'으로 새롭게 추천했어요."
            ),

            action="diet_replace",

            target_day=target_day,

            target_meal=target_meal,

            # Backend에서 해당 식단 슬롯 갱신에 사용
            data=replacement.model_dump(),
        )

    # =====================================================
    # 7. General Chat
    # =====================================================

    answer = await answer_general_chat(
        request.content
    )

    return ChatResponse(
        intent="general_chat",
        message=answer,
        action="general_chat",
    )