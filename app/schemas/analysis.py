from typing import Literal

from pydantic import BaseModel, Field


# --------------------------------------------------
# 체성분 데이터
# --------------------------------------------------

class BodyData(BaseModel):
    age: int | None = Field(
        default=None,
        ge=0,
        le=120,
    )

    gender: Literal[
        "male",
        "female",
        "other",
    ] | None = None

    height_cm: float | None = Field(
        default=None,
        gt=0,
    )

    weight_kg: float | None = Field(
        default=None,
        gt=0,
    )

    bmi: float | None = Field(
        default=None,
        gt=0,
    )

    body_fat_percentage: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )

    skeletal_muscle_mass_kg: float | None = Field(
        default=None,
        ge=0,
    )

    visceral_fat_level: float | None = Field(
        default=None,
        ge=0,
    )

    waist_hip_ratio: float | None = Field(
        default=None,
        ge=0,
    )

    basal_metabolic_rate: float | None = Field(
        default=None,
        ge=0,
    )


# --------------------------------------------------
# 건강검진 데이터
# --------------------------------------------------

class HealthData(BaseModel):
    systolic_bp: float | None = Field(
        default=None,
        ge=0,
    )

    diastolic_bp: float | None = Field(
        default=None,
        ge=0,
    )

    fasting_glucose: float | None = Field(
        default=None,
        ge=0,
    )

    hba1c: float | None = Field(
        default=None,
        ge=0,
    )

    total_cholesterol: float | None = Field(
        default=None,
        ge=0,
    )

    ldl: float | None = Field(
        default=None,
        ge=0,
    )

    hdl: float | None = Field(
        default=None,
        ge=0,
    )

    triglyceride: float | None = Field(
        default=None,
        ge=0,
    )

    ast: float | None = Field(
        default=None,
        ge=0,
    )

    alt: float | None = Field(
        default=None,
        ge=0,
    )

    gamma_gtp: float | None = Field(
        default=None,
        ge=0,
    )

    creatinine: float | None = Field(
        default=None,
        ge=0,
    )


# --------------------------------------------------
# 건강 분석 요청
# --------------------------------------------------

class AnalysisRequest(BaseModel):
    # 내부 추적용.
    # 외부 AI / RAG에는 전달하지 않음.
    user_id: str | None = None

    # LLM 요청에 사용할 수 있으나
    # 외부 전달 전 Privacy Filter 적용 필수.
    question: str | None = Field(
        default=None,
        max_length=1000,
    )

    body_data: BodyData = Field(
        default_factory=BodyData,
    )

    health_data: HealthData = Field(
        default_factory=HealthData,
    )


# --------------------------------------------------
# 개별 건강 지표 분석 결과
# --------------------------------------------------

class MetricResult(BaseModel):
    value: float | None = None

    status: str

    message: str | None = None

    # 해당 상태를 판단한 기준
    criterion: str | None = None

    # 기준 출처 기관
    source: str | None = None

    # 참고 문서 / 가이드라인
    reference: str | None = None


# --------------------------------------------------
# LLM 건강 위험요인
# --------------------------------------------------

class HealthRiskItem(BaseModel):
    name: str

    reason: str

    severity: Literal[
        "low",
        "moderate",
        "high",
    ]


# --------------------------------------------------
# RAG 출처 정보
# --------------------------------------------------

class SourceItem(BaseModel):
    source_org: str

    title: str


# --------------------------------------------------
# 최종 LLM 분석 결과
# --------------------------------------------------

class FinalAnswer(BaseModel):
    # 현재 상태 요약
    summary: str = ""

    # 위험요인 관련 안내
    health_risks: list[
        HealthRiskItem
    ] = Field(
        default_factory=list,
    )

    # 맞춤 운동 안내
    exercise: list[str] = Field(
        default_factory=list,
    )

    # 맞춤 식단 안내
    diet: list[str] = Field(
        default_factory=list,
    )

    # 주의사항
    cautions: list[str] = Field(
        default_factory=list,
    )

    # RAG 근거 출처
    sources: list[
        SourceItem
    ] = Field(
        default_factory=list,
    )


# --------------------------------------------------
# 건강 분석 최종 응답
# --------------------------------------------------

class AnalysisResponse(BaseModel):
    # 개인정보 최소화를 위해
    # 일반적으로 null로 반환
    user_id: str | None = None

    # Rule Engine 기반 체성분 분석
    body_analysis: dict[
        str,
        MetricResult,
    ] = Field(
        default_factory=dict,
    )

    # Rule Engine 기반 건강검진 분석
    health_analysis: dict[
        str,
        MetricResult,
    ] = Field(
        default_factory=dict,
    )

    # --------------------------------------------------
    # RAG + LLM 최종 결과
    # --------------------------------------------------

    final_answer: FinalAnswer | None = None

    # --------------------------------------------------
    # 경고 메시지
    # --------------------------------------------------

    warnings: list[str] = Field(
        default_factory=list,
    )

    # --------------------------------------------------
    # 현재 분석 파이프라인 버전
    # --------------------------------------------------

    analysis_version: str = "langgraph-v1"