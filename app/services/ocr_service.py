from typing import Any


def normalize_health_checkup(
    extracted_data: dict[str, Any],
) -> dict[str, Any]:
    """
    OCR health_checkup 결과를
    Auto-Fit 분석 파이프라인의 필드명으로 변환한다.

    null 값은 그대로 유지한다.
    """

    return {
        "bmi": extracted_data.get("bmi"),

        "systolic_bp": extracted_data.get(
            "systolic_bp"
        ),
        "diastolic_bp": extracted_data.get(
            "diastolic_bp"
        ),

        "fasting_glucose": extracted_data.get(
            "fasting_glucose"
        ),

        "total_cholesterol": extracted_data.get(
            "total_cholesterol"
        ),

        "triglyceride": extracted_data.get(
            "triglycerides"
        ),

        "hdl": extracted_data.get(
            "hdl_cholesterol"
        ),

        "ldl": extracted_data.get(
            "ldl_cholesterol"
        ),

        "ast": extracted_data.get("ast"),
        "alt": extracted_data.get("alt"),

        "gamma_gtp": extracted_data.get(
            "gamma_gtp"
        ),

        "creatinine": extracted_data.get(
            "serum_creatinine"
        ),
    }


def normalize_body_composition(
    extracted_data: dict[str, Any],
) -> dict[str, Any]:
    """
    OCR body_composition 결과를
    Auto-Fit 분석 파이프라인의 필드명으로 변환한다.
    """

    return {
        "bmi": extracted_data.get(
            "bmi"
        ),

        "body_fat_percentage": extracted_data.get(
            "body_fat_pct"
        ),

        "skeletal_muscle_mass_kg": extracted_data.get(
            "skeletal_muscle_kg"
        ),

        "basal_metabolic_rate": extracted_data.get(
            "basal_metabolic_rate_kcal"
        ),

        "waist_hip_ratio": extracted_data.get(
            "waist_hip_ratio"
        ),

        "visceral_fat_level": extracted_data.get(
            "visceral_fat_level"
        ),
    }