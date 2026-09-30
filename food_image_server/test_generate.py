from app.image_generator import FoodImageGenerator


def main() -> None:
    generator = FoodImageGenerator()

    label = generator.generate_and_label(
        base_dir=".",
        menu_name="두부 브로콜리 계란볶음",
        meal_type="dinner",
        total_kcal=430,
        carbohydrate_g=24,
        protein_g=32,
        fat_g=23,
        ingredients=[
            {
                "name": "두부",
                "amount_g": 150,
                "carbohydrate_g": 4,
                "protein_g": 12,
                "fat_g": 7,
                "kcal": 125,
            },
            {
                "name": "계란",
                "amount_g": 100,
                "carbohydrate_g": 1,
                "protein_g": 13,
                "fat_g": 10,
                "kcal": 145,
            },
            {
                "name": "브로콜리",
                "amount_g": 100,
                "carbohydrate_g": 7,
                "protein_g": 3,
                "fat_g": 1,
                "kcal": 45,
            },
        ],
        used_refrigerator_ingredients=[
            "두부",
            "계란",
            "브로콜리",
        ],
    )

    print("[DONE] image saved:", label.image_path)
    print("[DONE] label saved:", label.label_path)
    print("[DONE] image_id:", label.image_id)


if __name__ == "__main__":
    main()