from typing import Any

from app.services.privacy_service import (
    privacy_service,
    ALLOWED_HEALTH_FIELDS,
)


# --------------------------------------------------
# Rule Engine에서 사용할 필드
# --------------------------------------------------

RULE_ENGINE_FIELDS = {
    "bmi",
    "systolic_bp",
    "diastolic_bp",
    "fasting_glucose",
    "hba1c",
    "total_cholesterol",
    "ldl",
    "hdl",
    "triglyceride",
}


# --------------------------------------------------
# RAG 검색용으로 사용할 필드
# --------------------------------------------------

RAG_FIELDS = {
    "bmi",
    "body_fat_percentage",
    "skeletal_muscle_mass_kg",
    "systolic_bp",
    "diastolic_bp",
    "fasting_glucose",
    "hba1c",
    "total_cholesterol",
    "ldl",
    "hdl",
    "triglyceride",
}


class FeatureSelectorService:

    # --------------------------------------------------
    # body_data + health_data 통합
    # --------------------------------------------------

    def flatten_health_payload(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        body_data와 health_data를 하나의 dict로 합친다.

        개인정보 필드는 여기서 직접 제거하지 않는다.
        실제 필터링은 PrivacyService에서 처리한다.
        """

        flattened: dict[str, Any] = {}

        body_data = payload.get(
            "body_data",
            {},
        )

        health_data = payload.get(
            "health_data",
            {},
        )

        if isinstance(
            body_data,
            dict,
        ):
            flattened.update(
                body_data
            )

        if isinstance(
            health_data,
            dict,
        ):
            flattened.update(
                health_data
            )

        return flattened

    # --------------------------------------------------
    # Privacy Allowlist 적용
    # --------------------------------------------------

    def select_allowed_features(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Privacy allowlist를 적용하여
        분석에 사용할 수 있는 건강정보만 추출한다.

        이름, 전화번호, 이메일, user_id,
        인증정보 등의 개인정보 및 보안정보는
        외부 AI/RAG 입력으로 전달하지 않는다.
        """

        flattened = (
            self.flatten_health_payload(
                payload
            )
        )

        safe_data = (
            privacy_service
            .filter_health_data(
                flattened
            )
        )

        return safe_data

    # --------------------------------------------------
    # Rule Engine 입력 생성
    # --------------------------------------------------

    def select_rule_engine_input(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        Rule Engine에서 사용하는 필드만 추출한다.
        """

        safe_data = (
            self.select_allowed_features(
                payload
            )
        )

        return {
            key: value
            for key, value in safe_data.items()
            if key in RULE_ENGINE_FIELDS
        }

    # --------------------------------------------------
    # RAG 입력 생성
    # --------------------------------------------------

    def select_rag_input(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        RAG 검색에 사용할 최소 건강정보만 추출한다.

        사용자 식별정보는 포함하지 않는다.
        """

        safe_data = (
            self.select_allowed_features(
                payload
            )
        )

        return {
            key: value
            for key, value in safe_data.items()
            if key in RAG_FIELDS
        }

    # --------------------------------------------------
    # 미지원 필드 확인
    # --------------------------------------------------

    def find_unsupported_fields(
        self,
        payload: dict[str, Any],
    ) -> list[str]:
        """
        body_data / health_data 안에 들어왔지만
        현재 AI 서버가 지원하지 않는 필드를 찾아 반환한다.

        지원하지 않는 필드는 분석 모듈이나
        외부 AI로 전달하지 않는다.
        """

        flattened = (
            self.flatten_health_payload(
                payload
            )
        )

        unsupported: list[str] = []

        for key in flattened:
            if key not in ALLOWED_HEALTH_FIELDS:
                unsupported.append(
                    key
                )

        return unsupported

    # --------------------------------------------------
    # 전체 안전 입력 생성
    # --------------------------------------------------

    def build_safe_analysis_inputs(
        self,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """
        한 번의 호출로 현재 분석 파이프라인에서 사용할
        안전한 입력 데이터를 생성한다.

        생성되는 데이터:
        - safe_health_data
        - rule_engine_input
        - rag_input
        - unsupported_fields
        """

        return {
            "safe_health_data": (
                self.select_allowed_features(
                    payload
                )
            ),

            "rule_engine_input": (
                self.select_rule_engine_input(
                    payload
                )
            ),

            "rag_input": (
                self.select_rag_input(
                    payload
                )
            ),

            "unsupported_fields": (
                self.find_unsupported_fields(
                    payload
                )
            ),
        }


feature_selector_service = (
    FeatureSelectorService()
)