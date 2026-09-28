from typing import Any

from app.schemas.analysis import (
    BodyData,
    HealthData,
)


# =========================================================
# Health Checkup
# =========================================================


def normalize_health_checkup(
    extracted_data: dict[str, Any] | None,
) -> HealthData:
    """
    OCR health_checkup extracted_data를
    Auto-Fit HealthData로 변환한다.

    OCR 필드:
        systolic_bp
        diastolic_bp
        triglycerides
        hdl_cholesterol
        ldl_cholesterol
        serum_creatinine

    Auto-Fit 내부 필드:
        systolic_bp
        diastolic_bp
        triglyceride
        hdl
        ldl
        creatinine

    OCR의 null 값은 그대로 None으로 유지한다.
    """

    if not extracted_data:
        return HealthData()

    return HealthData(
        systolic_bp=extracted_data.get(
            "systolic_bp"
        ),

        diastolic_bp=extracted_data.get(
            "diastolic_bp"
        ),

        fasting_glucose=extracted_data.get(
            "fasting_glucose"
        ),

        # 현재 OCR 계약에는 HbA1c 필드가 없다.
        # 따라서 임의로 생성하지 않는다.
        hba1c=None,

        total_cholesterol=extracted_data.get(
            "total_cholesterol"
        ),

        triglyceride=extracted_data.get(
            "triglycerides"
        ),

        hdl=extracted_data.get(
            "hdl_cholesterol"
        ),

        ldl=extracted_data.get(
            "ldl_cholesterol"
        ),

        ast=extracted_data.get(
            "ast"
        ),

        alt=extracted_data.get(
            "alt"
        ),

        gamma_gtp=extracted_data.get(
            "gamma_gtp"
        ),

        creatinine=extracted_data.get(
            "serum_creatinine"
        ),
    )


# =========================================================
# Body Composition
# =========================================================


def normalize_body_composition(
    extracted_data: dict[str, Any] | None,
) -> BodyData:
    """
    OCR body_composition extracted_data를
    Auto-Fit BodyData로 변환한다.
    """

    if not extracted_data:
        return BodyData()

    return BodyData(
        bmi=extracted_data.get(
            "bmi"
        ),

        body_fat_percentage=extracted_data.get(
            "body_fat_pct"
        ),

        skeletal_muscle_mass_kg=extracted_data.get(
            "skeletal_muscle_kg"
        ),

        visceral_fat_level=extracted_data.get(
            "visceral_fat_level"
        ),

        waist_hip_ratio=extracted_data.get(
            "waist_hip_ratio"
        ),

        basal_metabolic_rate=extracted_data.get(
            "basal_metabolic_rate_kcal"
        ),
    )


# =========================================================
# Unified Adapter
# =========================================================


def normalize_ocr_result(
    document_type: str,
    extracted_data: dict[str, Any] | None,
) -> tuple[
    BodyData | None,
    HealthData | None,
]:
    """
    OCR document_type에 따라 분석 입력으로 변환한다.

    반환:
        body_data,
        health_data
    """

    if document_type == "health_checkup":
        return (
            None,
            normalize_health_checkup(
                extracted_data
            ),
        )

    if document_type == "body_composition":
        return (
            normalize_body_composition(
                extracted_data
            ),
            None,
        )

    raise ValueError(
        f"Unsupported OCR document_type: {document_type}"
    )