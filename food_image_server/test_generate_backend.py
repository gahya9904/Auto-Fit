import base64
from pathlib import Path

from app.image_generator import (
    FoodImageGenerator,
)

from app.schemas import (
    MenuImageGenerateRequest,
)


def main():
    request = (
        MenuImageGenerateRequest(
            schema_version="1.0",

            request_id=(
                "foods:29a3f1d9c72"
            ),

            image_key=(
                "foods:29a3f1d9c72"
            ),

            menu_name=(
                "현미밥, 닭가슴살구이, 브로콜리"
            ),

            meal_type="breakfast",

            foods=[
                {
                    "food_name": "현미밥",
                    "quantity": 150,
                    "unit": "g",
                },
                {
                    "food_name": "닭가슴살구이",
                    "quantity": 90,
                    "unit": "g",
                },
                {
                    "food_name": "브로콜리",
                    "quantity": 100,
                    "unit": "g",
                },
            ],

            food_tags=[
                "닭가슴살",
                "현미밥",
                "채소",
            ],

            visual_spec={
                "style": (
                    "realistic_food_photography"
                ),
                "composition": (
                    "single_meal"
                ),
                "camera_view": (
                    "three_quarter"
                ),
                "background": (
                    "clean_neutral"
                ),
                "people": False,
                "text": False,
                "logo": False,
                "width": 1024,
                "height": 1024,
                "format": "png",
            },
        )
    )

    generator = (
        FoodImageGenerator()
    )

    response = (
        generator.generate(
            request
        )
    )

    print()
    print(
        "===== RESPONSE ====="
    )

    print(
        "request_id:",
        response.request_id,
    )

    print(
        "image_key:",
        response.image_key,
    )

    print(
        "status:",
        response.status,
    )

    print(
        "width:",
        response.image.width,
    )

    print(
        "height:",
        response.image.height,
    )

    print(
        "seed:",
        response.generation.seed,
    )

    print(
        "generation_time_ms:",
        response.metadata.generation_time_ms,
    )

    print(
        "prompt:",
        response.generation.prompt,
    )

    print(
        "base64 length:",
        len(
            response.image.base64
        ),
    )

    # ---------------------------------------------
    # 테스트용 PNG 복원
    # ---------------------------------------------

    png_bytes = base64.b64decode(
        response.image.base64
    )

    output_dir = Path(
        "generated"
    )

    output_dir.mkdir(
        exist_ok=True
    )

    output_path = (
        output_dir
        / "backend_test.png"
    )

    output_path.write_bytes(
        png_bytes
    )

    print(
        "[DONE] saved:",
        output_path.resolve(),
    )


if __name__ == "__main__":
    main()