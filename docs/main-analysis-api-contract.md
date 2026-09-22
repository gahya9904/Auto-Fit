# 종합 건강 분석 메인 API

`GET /api/health-assessments/latest`는 로그인한 사용자의 최신 평가에 저장된 개인화 분석을 우선 반환한다. 저장값이 없으면 평가 당시 목표와 확인된 팝업 판정으로 임시 문구를 구성한다. `Authorization: Bearer <Supabase access token>`이 필요하다. 최신 평가는 조회 시점 이전의 `assessed_at` 내림차순, 평가 ID 내림차순으로 고른다.

## 응답

```json
{
  "assessment_id": "20260916-0000-4000-8000-000000000006",
  "headline": {"title": "목표는 유지하고, 방향은 더 건강하게"},
  "summary": {"title": "지금은 근육을 지키며 감량해야 해요", "description": "평가 시 저장한 개인화 요약"},
  "goal": {"text": "결혼식 준비를 위한 단기간 체중 감량"},
  "strategy": {
    "title": "근육을 지키는 결혼식 맞춤 감량 전략",
    "tags": ["체지방 감량", "근육 유지", "식단·근력 병행"],
    "message": "빠른 감량보다 건강한 체성분 개선을 우선해요."
  },
  "key_metric_keys": ["body_fat_percentage", "skeletal_muscle_mass_kg", "fasting_glucose"],
  "recommendation_reasons": [{
    "title": "체중보다 체성분을 우선했어요",
    "description": "평가 시 저장한 추천 근거",
    "evidence_metric_keys": ["bmi", "weight_kg", "body_fat_mass_kg"]
  }],
  "final_direction": {"from": "단기간 체중 감량", "to": "근육 유지 기반 체지방 감량"}
}
```

위 문구와 수치는 **계약 형식을 설명하는 예시**다. 서버는 이 예시를 기본값으로 반환하지 않는다. 평가 생성 과정은 `health_assessments.raw_result.total_analysis`에 `assessment_id`를 제외한 위 구조를 저장할 수 있다. 저장값이 있으면 이를 검증하고 필요한 필드만 반환한다. 저장값이 없는 평가에는 아래의 제한된 임시 문구 생성 규칙을 적용한다.

백엔드 평가 작성기는 `backend.app.analysis_summary.attach_main_analysis(existing_raw_result, analysis)`를 호출해 분석 내용을 검증하고 기존 `popup_criteria` 등 다른 `raw_result` 필드를 보존한 뒤, **평가 저장과 같은 트랜잭션에서** 결과를 기록한다. 이 함수는 데이터베이스에 직접 쓰지 않으며, 생성 문구나 건강 판단을 만들어 내지 않는다.

## 저장값이 없을 때의 임시 문구

평가의 `input_snapshot.goal.text`가 있어야 한다. 선택 필드 `goal_type: "weight_loss"`, `short_term: true`와 체지방률 `high`, 골격근량 `low`, 공복혈당 `caution`이 함께 확인되면 [문구 협의안](main-analysis-frontend-alignment.md)의 A안을 반환한다. 나머지 목표와 판정 조합은 확인된 지표 이름·판정만 언급하는 일반 문구를 반환한다. 지표는 측정값, 평가 당시 `criteria_id`, `source_ids`, 확정 판정(`low`, `normal`, `caution`, `high`)이 모두 있어야 사용한다. 핵심 지표는 최대 3개를 백엔드가 선택한다. 목표 또는 사용 가능한 지표가 없으면 404다. 임시 문구는 조회 시 계산하며 DB에 저장하지 않는다. 기존 평가에 필요한 목표·판정 스냅샷이 없으면 404가 유지된다.

`key_metric_keys`는 표시 순서대로 최대 3개다. `recommendation_reasons`도 저장 순서대로 반환하며, 각 `evidence_metric_keys`는 팝업 지표와 연결된다. 지원 키는 `bmi`, `weight_kg`, `body_fat_mass_kg`, `body_fat_percentage`, `skeletal_muscle_mass_kg`, `fasting_glucose`, `systolic_bp`, `diastolic_bp`다. 그 밖의 지표를 사용하려면 [팝업 API](analysis-popup-api-contract.md)의 `metrics[]`도 먼저 확장해야 한다. 존재하지 않는 키나 필수 내용이 빠진 저장값은 형식 오류로 처리한다.

프론트는 메인 응답의 `assessment_id`로 `GET /api/health-assessments/{assessment_id}/popups`를 호출한다. 각 키를 `metrics[].key`에 매칭하고, `display_value`, `unit`, `status_label`, `ranges`, `source_ids`를 표시한다. 팝업에 해당 값이나 기준이 없는 경우 UI에서 측정값 없음 또는 판정 보류 상태를 표시한다. 프론트는 지표 순위, 판정 또는 추천 문구를 다시 계산하지 않는다.

## 실패 응답

| 상태 | 의미 |
|---|---|
| 401 | 인증 필요 |
| 404 | 평가가 없거나, 저장된 분석이 없고 임시 문구 생성에 필요한 목표·확정 판정도 없음 |
| 502 | 저장소 조회 실패 또는 저장된 분석 형식 오류 |

저장된 `total_analysis`가 잘못된 형식이면 임시 문구로 대체하지 않고 502를 반환한다. 임시 문구는 검증 가능한 데이터가 있을 때만 제공하며, 평가 생성 경로에서 결과를 저장하면 그 결과가 우선한다.
