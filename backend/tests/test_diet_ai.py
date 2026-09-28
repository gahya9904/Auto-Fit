import asyncio
import json
from datetime import date

import pytest

from backend.app.diet_ai import (
    DietAIUnavailable,
    build_catalog_meals,
    daily_ai_meal_count,
    generate_ai_meals,
    mix_meals,
    select_ai_slots,
)


BASE_MEALS = [
    {"meal_type": meal_type, "meal_order": index, "recommended_calories": 400, "foods": []}
    for index, meal_type in enumerate(("breakfast", "lunch", "dinner", "snack"), 1)
]


def test_daily_ai_slots_always_select_two_or_three_meals() -> None:
    target_date = date(2026, 9, 28)
    for user_number in range(20):
        user_id = f"user-{user_number}"
        count = daily_ai_meal_count(user_id, target_date)
        slots = select_ai_slots(BASE_MEALS, user_id, target_date)
        assert count in (2, 3)
        assert len(slots) == count
        assert len({slot["meal_order"] for slot in slots}) == count


def test_generate_ai_meals_accepts_only_requested_slots() -> None:
    slots = BASE_MEALS[:2]

    async def fake_model(prompt: str) -> str:
        assert "user_id" not in prompt
        assert "두부" not in prompt
        assert "excluded_allergens" not in prompt
        slot = json.loads(prompt.rsplit("\n", 1)[-1])["slot"]
        return json.dumps(
            {
                "meals": [
                    {
                        "meal_type": slot["meal_type"],
                        "meal_order": slot["meal_order"],
                        "recommendation_note": "AI 추천",
                        "foods": [
                            {
                                "food_name": "채소 비빔밥",
                                "quantity": 300,
                                "unit": "g",
                                "calories": 400,
                                "carbohydrates": 60,
                                "protein": 18,
                                "fat": 10,
                            }
                        ],
                    }
                ]
            },
            ensure_ascii=False,
        )

    meals = asyncio.run(generate_ai_meals(slots, ["우유"], fake_model))

    assert len(meals) == 2
    assert {meal["source_type"] for meal in meals} == {"ai_generated"}
    assert all(meal["recommended_calories"] == 400 for meal in meals)


def test_generate_ai_meals_rejects_changed_slots() -> None:
    async def fake_model(prompt: str) -> str:
        return '{"meals": []}'

    with pytest.raises(DietAIUnavailable):
        asyncio.run(generate_ai_meals(BASE_MEALS[:2], [], fake_model))


def test_generate_ai_meals_selects_safe_candidate_per_slot() -> None:
    slots = BASE_MEALS[:2]
    attempts: dict[int, int] = {}

    async def fake_model(prompt: str) -> str:
        slot = json.loads(prompt.rsplit("\n", 1)[-1])["slot"]
        order = slot["meal_order"]
        attempts[order] = attempts.get(order, 0) + 1
        food_name = "우유 오트밀" if attempts[order] == 1 else "채소 비빔밥"
        return json.dumps(
            {
                "meals": [
                    {
                        "meal_type": slot["meal_type"],
                        "meal_order": order,
                        "recommendation_note": "AI 추천",
                        "foods": [
                            {
                                "food_name": food_name,
                                "quantity": 300,
                                "unit": "g",
                                "calories": 400,
                                "carbohydrates": 60,
                                "protein": 18,
                                "fat": 10,
                            }
                        ],
                    }
                ]
            },
            ensure_ascii=False,
        )

    meals = asyncio.run(generate_ai_meals(slots, ["우유"], fake_model))

    assert len(meals) == 2
    assert all(meal["foods"][0]["food_name"] == "채소 비빔밥" for meal in meals)
    assert attempts == {1: 2, 2: 2}


def test_mix_meals_keeps_db_catalog_remainder() -> None:
    ai_meals = [
        {
            **BASE_MEALS[index],
            "source_type": "ai_generated",
            "recommendation_note": "AI 추천",
            "foods": [{"food_name": "AI 메뉴", "calories": 400}],
        }
        for index in range(3)
    ]
    catalog = [
        {
            "food_item_id": "11111111-1111-4111-8111-111111111111",
            "name": "DB 현미밥",
            "serving_size": 100,
            "serving_unit": "g",
            "calories": 200,
            "carbohydrates": 40,
            "protein": 4,
            "fat": 1,
        }
    ]

    mixed = mix_meals(BASE_MEALS, ai_meals, catalog)

    assert [meal["source_type"] for meal in mixed].count("ai_generated") == 3
    assert [meal["source_type"] for meal in mixed].count("db_catalog") == 1
    assert mixed[-1]["foods"][0]["food_item_id"] == catalog[0]["food_item_id"]


def test_catalog_meals_require_usable_db_food() -> None:
    with pytest.raises(ValueError):
        build_catalog_meals(BASE_MEALS[-1:], [{"name": "열량없음", "calories": 0}])
