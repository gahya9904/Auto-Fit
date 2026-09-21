from app.schemas.analysis import (
    AnalysisRequest,
    AnalysisResponse,
    MetricResult,
)


class RuleEngineService:
    def analyze(
        self,
        request: AnalysisRequest,
    ) -> AnalysisResponse:

        body_results: dict[str, MetricResult] = {}
        health_results: dict[str, MetricResult] = {}
        warnings: list[str] = []

        body = request.body_data
        health = request.health_data

        # ============================================================
        # BMI
        # ============================================================

        bmi = body.bmi

        if (
            bmi is None
            and body.height_cm is not None
            and body.weight_kg is not None
        ):
            height_m = body.height_cm / 100

            bmi = round(
                body.weight_kg / (height_m ** 2),
                2,
            )

        if bmi is not None:

            if bmi < 18.5:
                status = "underweight"
                message = "BMI가 저체중 범위에 해당합니다."
                criterion = "BMI < 18.5 kg/m²"

            elif bmi < 23:
                status = "normal"
                message = "BMI가 정상 범위에 해당합니다."
                criterion = "18.5 ≤ BMI < 23.0 kg/m²"

            elif bmi < 25:
                status = "pre_obesity"
                message = "BMI가 비만전단계 범위에 해당합니다."
                criterion = "23.0 ≤ BMI < 25.0 kg/m²"

            elif bmi < 30:
                status = "obesity_class_1"
                message = "BMI가 1단계 비만 범위에 해당합니다."
                criterion = "25.0 ≤ BMI < 30.0 kg/m²"

            elif bmi < 35:
                status = "obesity_class_2"
                message = "BMI가 2단계 비만 범위에 해당합니다."
                criterion = "30.0 ≤ BMI < 35.0 kg/m²"

            else:
                status = "obesity_class_3"
                message = "BMI가 3단계 비만 범위에 해당합니다."
                criterion = "BMI ≥ 35.0 kg/m²"

            body_results["bmi"] = MetricResult(
                value=bmi,
                status=status,
                message=message,
                criterion=criterion,
                source="대한비만학회",
                reference="대한비만학회 비만 진료지침 2022 8판",
            )

        # ============================================================
        # 체지방률
        # ============================================================

        if body.body_fat_percentage is not None:

            body_results["body_fat_percentage"] = MetricResult(
                value=body.body_fat_percentage,
                status="collected",
                message="체지방률 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 골격근량
        # ============================================================

        if body.skeletal_muscle_mass_kg is not None:

            body_results["skeletal_muscle_mass_kg"] = MetricResult(
                value=body.skeletal_muscle_mass_kg,
                status="collected",
                message="골격근량 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 내장지방 레벨
        # ============================================================

        if body.visceral_fat_level is not None:

            body_results["visceral_fat_level"] = MetricResult(
                value=body.visceral_fat_level,
                status="collected",
                message="내장지방 레벨 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 허리-엉덩이 비율
        # ============================================================

        if body.waist_hip_ratio is not None:

            body_results["waist_hip_ratio"] = MetricResult(
                value=body.waist_hip_ratio,
                status="collected",
                message="허리-엉덩이 비율 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 기초대사량
        # ============================================================

        if body.basal_metabolic_rate is not None:

            body_results["basal_metabolic_rate"] = MetricResult(
                value=body.basal_metabolic_rate,
                status="collected",
                message="기초대사량 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 혈압
        # ============================================================

        sbp = health.systolic_bp
        dbp = health.diastolic_bp

        if sbp is not None and dbp is not None:

            if sbp < 120 and dbp < 80:
                status = "normal"
                message = "혈압이 정상 범위에 해당합니다."
                criterion = "수축기 < 120 mmHg 그리고 이완기 < 80 mmHg"

            elif sbp < 130 and dbp < 85:
                status = "prehypertension_stage_1"
                message = "혈압이 전고혈압 1단계 범위에 해당합니다."
                criterion = (
                    "수축기 120~129 mmHg 또는 "
                    "이완기 80~84 mmHg"
                )

            elif sbp < 140 and dbp < 90:
                status = "prehypertension_stage_2"
                message = "혈압이 전고혈압 2단계 범위에 해당합니다."
                criterion = (
                    "수축기 130~139 mmHg 또는 "
                    "이완기 85~89 mmHg"
                )

            elif sbp < 160 and dbp < 100:
                status = "hypertension_stage_1_range"
                message = (
                    "혈압이 고혈압 1단계에 해당하는 "
                    "높은 범위입니다."
                )
                criterion = (
                    "수축기 140~159 mmHg 또는 "
                    "이완기 90~99 mmHg"
                )

            else:
                status = "hypertension_stage_2_range"
                message = (
                    "혈압이 고혈압 2단계에 해당하는 "
                    "높은 범위입니다."
                )
                criterion = (
                    "수축기 ≥ 160 mmHg 또는 "
                    "이완기 ≥ 100 mmHg"
                )

            health_results["blood_pressure"] = MetricResult(
                value=sbp,
                status=status,
                message=message,
                criterion=criterion,
                source="대한고혈압학회",
                reference="대한고혈압학회 고혈압 진료지침",
            )

        else:
            if sbp is not None:
                health_results["systolic_bp"] = MetricResult(
                    value=sbp,
                    status="collected",
                    message="수축기 혈압만 수집되었습니다.",
                    criterion=None,
                    source=None,
                    reference=None,
                )

            if dbp is not None:
                health_results["diastolic_bp"] = MetricResult(
                    value=dbp,
                    status="collected",
                    message="이완기 혈압만 수집되었습니다.",
                    criterion=None,
                    source=None,
                    reference=None,
                )

        # ============================================================
        # 공복혈당
        # ============================================================

        glucose = health.fasting_glucose

        if glucose is not None:

            if glucose < 100:
                status = "normal"
                message = "공복혈당이 정상 범위에 해당합니다."
                criterion = "공복혈당 < 100 mg/dL"

            elif glucose < 126:
                status = "impaired_fasting_glucose"
                message = "공복혈당장애 범위에 해당합니다."
                criterion = "100 ≤ 공복혈당 ≤ 125 mg/dL"

            else:
                status = "diabetes_diagnostic_range"
                message = (
                    "공복혈당이 당뇨병 진단 기준에 해당하는 "
                    "높은 범위입니다. 단일 검사만으로 "
                    "확진하지 않습니다."
                )
                criterion = "공복혈당 ≥ 126 mg/dL"

            health_results["fasting_glucose"] = MetricResult(
                value=glucose,
                status=status,
                message=message,
                criterion=criterion,
                source="대한당뇨병학회",
                reference="대한당뇨병학회 당뇨병 진단기준",
            )

        # ============================================================
        # HbA1c
        # ============================================================

        hba1c = health.hba1c

        if hba1c is not None:

            if hba1c < 5.7:
                status = "normal"
                message = "HbA1c가 정상 범위에 해당합니다."
                criterion = "HbA1c < 5.7%"

            elif hba1c < 6.5:
                status = "prediabetes_range"
                message = (
                    "HbA1c가 당뇨병 전단계 범위에 해당합니다."
                )
                criterion = "5.7% ≤ HbA1c ≤ 6.4%"

            else:
                status = "diabetes_diagnostic_range"
                message = (
                    "HbA1c가 당뇨병 진단 기준에 해당하는 "
                    "높은 범위입니다. 단일 검사만으로 "
                    "확진하지 않습니다."
                )
                criterion = "HbA1c ≥ 6.5%"

            health_results["hba1c"] = MetricResult(
                value=hba1c,
                status=status,
                message=message,
                criterion=criterion,
                source="대한당뇨병학회",
                reference="대한당뇨병학회 당뇨병 진단기준",
            )

                # ============================================================
        # 총콜레스테롤
        # ============================================================

        total_cholesterol = health.total_cholesterol

        if total_cholesterol is not None:

            if total_cholesterol < 200:
                status = "desirable"
                message = "총콜레스테롤이 바람직한 범위에 해당합니다."
                criterion = "총콜레스테롤 < 200 mg/dL"

            elif total_cholesterol < 240:
                status = "borderline_high"
                message = "총콜레스테롤이 경계 범위에 해당합니다."
                criterion = "200 ≤ 총콜레스테롤 < 240 mg/dL"

            else:
                status = "high"
                message = "총콜레스테롤이 높은 범위에 해당합니다."
                criterion = "총콜레스테롤 ≥ 240 mg/dL"

            health_results["total_cholesterol"] = MetricResult(
                value=total_cholesterol,
                status=status,
                message=message,
                criterion=criterion,
                source="한국지질·동맥경화학회",
                reference="이상지질혈증 진료지침 제5판",
            )

        # ============================================================
        # LDL 콜레스테롤
        # ============================================================

        ldl = health.ldl

        if ldl is not None:

            if ldl < 100:
                status = "optimal"
                message = "LDL 콜레스테롤이 적정 범위에 해당합니다."
                criterion = "LDL < 100 mg/dL"

            elif ldl < 130:
                status = "near_optimal"
                message = "LDL 콜레스테롤이 적정에 가까운 범위입니다."
                criterion = "100 ≤ LDL < 130 mg/dL"

            elif ldl < 160:
                status = "borderline_high"
                message = "LDL 콜레스테롤이 경계 범위에 해당합니다."
                criterion = "130 ≤ LDL < 160 mg/dL"

            elif ldl < 190:
                status = "high"
                message = "LDL 콜레스테롤이 높은 범위에 해당합니다."
                criterion = "160 ≤ LDL < 190 mg/dL"

            else:
                status = "very_high"
                message = "LDL 콜레스테롤이 매우 높은 범위에 해당합니다."
                criterion = "LDL ≥ 190 mg/dL"

            health_results["ldl"] = MetricResult(
                value=ldl,
                status=status,
                message=message,
                criterion=criterion,
                source="한국지질·동맥경화학회",
                reference="이상지질혈증 진료지침 제5판",
            )

        # ============================================================
        # HDL 콜레스테롤
        # ============================================================

        hdl = health.hdl

        if hdl is not None:

            if hdl < 40:
                status = "low"
                message = "HDL 콜레스테롤이 낮은 범위에 해당합니다."
                criterion = "HDL < 40 mg/dL"

            elif hdl >= 60:
                status = "high"
                message = "HDL 콜레스테롤이 높은 범위에 해당합니다."
                criterion = "HDL ≥ 60 mg/dL"

            else:
                status = "acceptable"
                message = "HDL 콜레스테롤이 일반적인 범위에 해당합니다."
                criterion = "40 ≤ HDL < 60 mg/dL"

            health_results["hdl"] = MetricResult(
                value=hdl,
                status=status,
                message=message,
                criterion=criterion,
                source="한국지질·동맥경화학회",
                reference="이상지질혈증 진료지침 제5판",
            )

        # ============================================================
        # 중성지방
        # ============================================================

        triglyceride = health.triglyceride

        if triglyceride is not None:

            if triglyceride < 150:
                status = "normal"
                message = "중성지방이 정상 범위에 해당합니다."
                criterion = "중성지방 < 150 mg/dL"

            elif triglyceride < 200:
                status = "borderline_high"
                message = "중성지방이 경계 범위에 해당합니다."
                criterion = "150 ≤ 중성지방 < 200 mg/dL"

            elif triglyceride < 500:
                status = "high"
                message = "중성지방이 높은 범위에 해당합니다."
                criterion = "200 ≤ 중성지방 < 500 mg/dL"

            else:
                status = "very_high"
                message = "중성지방이 매우 높은 범위에 해당합니다."
                criterion = "중성지방 ≥ 500 mg/dL"

            health_results["triglyceride"] = MetricResult(
                value=triglyceride,
                status=status,
                message=message,
                criterion=criterion,
                source="한국지질·동맥경화학회",
                reference="이상지질혈증 진료지침 제5판",
            )

        # ============================================================
        # AST
        # ============================================================

        if health.ast is not None:

            health_results["ast"] = MetricResult(
                value=health.ast,
                status="collected",
                message="AST 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # ALT
        # ============================================================

        if health.alt is not None:

            health_results["alt"] = MetricResult(
                value=health.alt,
                status="collected",
                message="ALT 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # Gamma-GTP
        # ============================================================

        if health.gamma_gtp is not None:

            health_results["gamma_gtp"] = MetricResult(
                value=health.gamma_gtp,
                status="collected",
                message="Gamma-GTP 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # Creatinine
        # ============================================================

        if health.creatinine is not None:

            health_results["creatinine"] = MetricResult(
                value=health.creatinine,
                status="collected",
                message="크레아티닌 데이터가 수집되었습니다.",
                criterion=None,
                source=None,
                reference=None,
            )

        # ============================================================
        # 데이터 부족 경고
        # ============================================================

        if not body_results:
            warnings.append(
                "분석 가능한 체성분 데이터가 부족합니다."
            )

        if not health_results:
            warnings.append(
                "분석 가능한 건강검진 데이터가 부족합니다."
            )

        # ============================================================
        # 최종 응답
        # ============================================================

        return AnalysisResponse(
            user_id=request.user_id,
            body_analysis=body_results,
            health_analysis=health_results,
            warnings=warnings,
            analysis_version="rule-engine-v2",
        )


rule_engine_service = RuleEngineService()