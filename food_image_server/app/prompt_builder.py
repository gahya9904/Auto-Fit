from __future__ import annotations

from app.schemas import (
    MenuImageGenerateRequest,
)


# =========================================================
# Korean -> English Food Mapping
# =========================================================


FOOD_TRANSLATIONS: dict[str, str] = {
    # Rice / grains
    "현미밥": (
        "a clearly visible separate mound of cooked brown rice, "
        "light brown whole-grain rice"
    ),
    "현미": "cooked brown rice",
    "흰쌀밥": "a clearly visible mound of cooked white rice",
    "밥": "a clearly visible serving of cooked rice",
    "잡곡밥": "a clearly visible mound of cooked mixed-grain rice",

    # Chicken
    "닭가슴살": (
        "clearly visible sliced lean chicken breast"
    ),
    "닭가슴살구이": (
        "clearly visible sliced grilled chicken breast "
        "with light grill marks"
    ),
    "닭고기": "cooked chicken",

    # Meat
    "소고기": "cooked sliced beef",
    "돼지고기": "cooked sliced pork",

    # Fish
    "연어": (
        "clearly visible grilled salmon fillet"
    ),
    "연어구이": (
        "clearly visible grilled salmon fillet"
    ),
    "고등어": "grilled mackerel fillet",
    "고등어구이": "grilled mackerel fillet",

    # Protein
    "두부": (
        "clearly visible white tofu pieces"
    ),
    "두부구이": (
        "clearly visible pan-grilled tofu slices, "
        "golden outside and white inside"
    ),
    "계란": "clearly visible cooked egg",
    "달걀": "clearly visible cooked egg",
    "삶은계란": (
        "clearly visible sliced boiled egg"
    ),
    "삶은달걀": (
        "clearly visible sliced boiled egg"
    ),
    "계란후라이": (
        "clearly visible fried egg"
    ),
    "스크램블에그": (
        "clearly visible soft yellow scrambled egg"
    ),

    # Vegetables
    "브로콜리": (
        "clearly visible green steamed broccoli florets"
    ),
    "시금치": (
        "clearly visible cooked green spinach"
    ),
    "양배추": "clearly visible shredded cabbage",
    "당근": "clearly visible sliced orange carrots",
    "토마토": "clearly visible fresh red tomato slices",
    "오이": "clearly visible fresh cucumber slices",
    "상추": "clearly visible fresh green lettuce",
    "양파": "clearly visible cooked onion slices",
    "버섯": "clearly visible cooked mushrooms",
    "파프리카": (
        "clearly visible sliced colorful bell peppers"
    ),

    # Carbohydrates
    "고구마": (
        "clearly visible pieces of cooked sweet potato"
    ),
    "감자": (
        "clearly visible cooked potato pieces"
    ),
    "오트밀": (
        "a clearly visible bowl of cooked oatmeal"
    ),

    # Fruits
    "사과": "clearly visible fresh apple slices",
    "바나나": "clearly visible banana slices",
    "블루베리": "clearly visible fresh blueberries",

    # Dairy
    "요거트": "plain yogurt",
    "그릭요거트": (
        "thick plain Greek yogurt"
    ),

    # Salad
    "샐러드": (
        "a clearly visible fresh green vegetable salad"
    ),
}


# =========================================================
# Food Tag Translation
# =========================================================


TAG_TRANSLATIONS: dict[str, str] = {
    "닭가슴살": "chicken breast",
    "현미밥": "brown rice",
    "현미": "brown rice",
    "채소": "vegetables",
    "야채": "vegetables",
    "고단백": "high-protein meal",
    "저지방": "low-fat meal",
    "샐러드": "fresh salad",
    "한식": "Korean-style meal",
    "두부": "tofu",
    "연어": "salmon",
    "고구마": "sweet potato",
}


# =========================================================
# Translation Utility
# =========================================================


def translate_food_name(
    food_name: str,
) -> str:
    """
    Stable Diffusion이 이해하기 쉽도록
    한국 음식명을 구체적인 영어 시각 묘사로 변환한다.

    단순 번역보다 '이미지에 어떻게 보여야 하는가'를
    포함하도록 작성한다.
    """

    cleaned = food_name.strip()

    return FOOD_TRANSLATIONS.get(
        cleaned,
        cleaned,
    )


def translate_tag(
    tag: str,
) -> str:
    cleaned = tag.strip()

    return TAG_TRANSLATIONS.get(
        cleaned,
        cleaned,
    )


# =========================================================
# Quantity Utility
# =========================================================


def build_quantity_description(
    quantity: float,
    max_quantity: float,
) -> str:
    """
    정확한 중량 계량을 이미지로 재현하지 않고
    foods 사이의 상대적인 비중만 표현한다.
    """

    if max_quantity <= 0:
        return "a medium visible portion of"

    ratio = (
        quantity
        / max_quantity
    )

    if ratio >= 0.80:
        return "a large visible portion of"

    if ratio >= 0.50:
        return "a medium visible portion of"

    return "a smaller but clearly visible portion of"


# =========================================================
# Visual Spec
# =========================================================


def build_camera_description(
    camera_view: str,
) -> str:

    mapping = {
        "three_quarter": (
            "three-quarter camera view"
        ),
        "top_down": (
            "top-down overhead camera view"
        ),
        "front": (
            "front-facing food photography"
        ),
    }

    return mapping.get(
        camera_view,
        "three-quarter camera view",
    )


def build_background_description(
    background: str,
) -> str:

    mapping = {
        "clean_neutral": (
            "clean neutral dining background"
        ),
        "white": (
            "clean simple white background"
        ),
        "wooden_table": (
            "simple natural wooden dining table"
        ),
    }

    return mapping.get(
        background,
        "clean neutral dining background",
    )


def build_style_description(
    style: str,
) -> str:

    mapping = {
        "realistic_food_photography": (
            "highly realistic professional food photography"
        ),
    }

    return mapping.get(
        style,
        "highly realistic professional food photography",
    )


# =========================================================
# Food-specific Rules
# =========================================================


def build_food_specific_rules(
    request: MenuImageGenerateRequest,
) -> list[str]:
    """
    특정 음식이 누락되거나 다른 음식으로 대체되는 것을
    줄이기 위한 추가 프롬프트 규칙.
    """

    food_names = {
        food.food_name.strip()
        for food in request.foods
    }

    rules: list[str] = []

    # Rice
    if (
        "현미밥" in food_names
        or "현미" in food_names
    ):
        rules.append(
            "Brown rice must be clearly visible as a separate mound "
            "and must not be omitted or replaced with white rice."
        )

    if (
        "흰쌀밥" in food_names
        or "밥" in food_names
    ):
        rules.append(
            "Rice must be clearly visible as a distinct separate portion."
        )

    # Chicken
    if (
        "닭가슴살" in food_names
        or "닭가슴살구이" in food_names
    ):
        rules.append(
            "Chicken breast must be clearly visible as sliced lean chicken breast "
            "and must not be replaced with fried chicken or other meat."
        )

    # Broccoli
    if "브로콜리" in food_names:
        rules.append(
            "Green broccoli florets must be clearly visible as a separate food item."
        )

    # Tofu
    if (
        "두부" in food_names
        or "두부구이" in food_names
    ):
        rules.append(
            "Tofu must be clearly identifiable as white tofu pieces "
            "and must not look like meat."
        )

    # Salmon
    if (
        "연어" in food_names
        or "연어구이" in food_names
    ):
        rules.append(
            "Salmon must be clearly visible as a distinct salmon fillet."
        )

    return rules


# =========================================================
# Prompt Builder
# =========================================================


def build_image_prompt(
    request: MenuImageGenerateRequest,
) -> str:
    """
    Backend 요청을 Stable Diffusion용
    최종 영어 prompt로 변환한다.

    중요:
    - foods의 모든 항목이 반드시 한 이미지 안에 보여야 한다.
    - 각 음식은 서로 식별 가능한 형태로 표현한다.
    - 음식 누락 및 임의 음식 추가를 최대한 방지한다.
    """

    foods = request.foods

    max_quantity = max(
        food.quantity
        for food in foods
    )

    # -----------------------------------------------------
    # Numbered food list
    # -----------------------------------------------------

    food_descriptions: list[str] = []

    for index, food in enumerate(
        foods,
        start=1,
    ):
        translated_name = (
            translate_food_name(
                food.food_name
            )
        )

        quantity_description = (
            build_quantity_description(
                food.quantity,
                max_quantity,
            )
        )

        food_descriptions.append(
            f"{index}) "
            f"{quantity_description} "
            f"{translated_name}"
        )

    foods_text = "; ".join(
        food_descriptions
    )

    # -----------------------------------------------------
    # Tags
    # -----------------------------------------------------

    translated_tags = [
        translate_tag(tag)
        for tag in request.food_tags
        if tag.strip()
    ]

    tags_text = ""

    if translated_tags:
        tags_text = (
            "The overall meal theme is "
            + ", ".join(
                translated_tags
            )
            + ". "
        )

    # -----------------------------------------------------
    # Visual Spec
    # -----------------------------------------------------

    style_text = (
        build_style_description(
            request.visual_spec.style
        )
    )

    camera_text = (
        build_camera_description(
            request.visual_spec.camera_view
        )
    )

    background_text = (
        build_background_description(
            request.visual_spec.background
        )
    )

    # -----------------------------------------------------
    # Food-specific mandatory rules
    # -----------------------------------------------------

    specific_rules = (
        build_food_specific_rules(
            request
        )
    )

    specific_rules_text = " ".join(
        specific_rules
    )

    # -----------------------------------------------------
    # Restriction Rules
    # -----------------------------------------------------

    restrictions: list[str] = [
        "Do not add any food that is not listed.",
        "Do not replace any listed food with another food.",
        "Do not omit any listed food.",
        "Do not merge the listed foods into an unrecognizable mixed dish.",
        "No unnecessary side dishes.",
        "No sauces covering or hiding the main foods.",
    ]

    if not request.visual_spec.people:
        restrictions.extend(
            [
                "No people.",
                "No hands.",
                "No faces.",
            ]
        )

    if not request.visual_spec.text:
        restrictions.extend(
            [
                "No text.",
                "No letters.",
                "No numbers.",
            ]
        )

    if not request.visual_spec.logo:
        restrictions.extend(
            [
                "No logo.",
                "No watermark.",
                "No branded packaging.",
            ]
        )

    restriction_text = " ".join(
        restrictions
    )

    # -----------------------------------------------------
    # Final Prompt
    # -----------------------------------------------------

    prompt = (
        f"{style_text} of one complete Korean-style meal. "

        f"CRITICAL: ALL {len(foods)} requested foods must be present, "
        f"clearly visible, individually recognizable, and easy to identify "
        f"in the same image. "

        f"The meal must contain exactly these main foods: "
        f"{foods_text}. "

        f"Arrange each requested food as a visually distinct portion "
        f"on one plate or meal tray. "

        f"Place all major food items near the center of the frame "
        f"so they remain visible even if the application crops the image. "

        f"{specific_rules_text} "

        f"{camera_text}. "
        f"{background_text}. "

        f"Use natural realistic lighting, realistic food texture, "
        f"realistic proportions, clean plating, and an appetizing presentation. "

        f"{tags_text}"

        f"{restriction_text}"
    )

    return prompt