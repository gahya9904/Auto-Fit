# 종합 분석 팝업 API

2026-09-17 · 계산 버전 `1.0.0` · Swagger 그룹 `Health Analysis`

세 팝업의 데이터를 한 번에 조회한다. 이 API는 조회 전용이며 평가·건강자료·전략을 새로 생성하거나 저장하지 않는다.

## 조회

| Method | 경로 | 용도 |
|---|---|---|
| GET | `/api/health-assessments/latest/popups` | 본인의 최신 평가 조회. 평가 ID를 모를 때 사용 |
| GET | `/api/health-assessments/{assessment_id}/popups` | 배경 종합 분석과 동일한 평가 조회 |

인증: `Authorization: Bearer <Supabase access token>`. Swagger에서는 `Authorize`에 토큰을 입력한다. 기존 `authorization` 입력 필드를 사용할 경우 `Bearer ` 접두어를 포함한다. 인증되지 않은 요청은 401, 본인 평가가 없거나 연결 자료를 조회할 수 없으면 404, 잘못된 UUID는 422, 자료 조회 실패는 502다.

`latest`는 조회 시점 이후의 평가를 제외하고 `assessed_at`, 평가 ID 내림차순으로 한 건을 선택한다. 평가에 연결된 체성분·검진 기록만 사용하며 최신 다른 기록과 합치지 않는다. 평가 스냅샷에 당시 수치가 있으면 스냅샷이 우선한다. 연결 원본도 본인 소유인지 확인한다.

## 프론트 매핑

| 화면 | 응답 |
|---|---|
| 추가 지표 | `metrics` 중 `bmi`, `weight_kg`, `body_fat_mass_kg`, `interpretation` |
| 체지방률 기준 | `body_fat_percentage`의 값·상태·`ranges`·`criteria_*`·`source_ids` |
| 골격근량 기준 | `skeletal_muscle_mass_kg`의 동일 구조 |
| 건강검진 출처 | 실제 적용된 `sources`와 `applied_metric_keys` |

모든 수치는 십진 문자열 또는 null이다. `raw_value`는 반올림 전 판정값, `display_value`는 소수 1자리 HALF_UP 표시값이다. 원시값과 표시값의 경계가 다르면 원시값도 보여준다. `value_origin=calculated`이면 계산값임을 표시한다. `discrepancy`가 있으면 보고값/계산값 확인 안내를 제공한다.

상태: `low / normal / caution / high / unknown / review_required`. 데이터가 없으면 `display_value=null`, 상태 라벨은 `측정값 없음`이다. 값은 있지만 적용 기준이 없으면 `판정 보류`다. 모순이 있으면 `확인 필요`다. 체중과 지방량 kg 자체에는 임의 정상·높음 배지를 붙이지 않는다.

`ranges`의 `min/max`가 null이면 끝 경계가 없고 `min_inclusive/max_inclusive`로 포함 조건을 표시한다. 혈압은 수축기·이완기를 조합해 판정하므로 개별 수치의 1차원 범위표는 반환하지 않는다. 제조사 참고 범위는 별도 주의 구간 없이 낮음/정상/높음이다.

`sources`는 이번 판정에 사용한 출처만 반환한다. 출처 메타데이터 없는 과거 평가에 임의 출처를 붙이지 않는다. 발행·개정일을 모르면 null이다. `verified_at`은 앱이 참고 정보를 확인한 날짜이며 원문 개정일이 아니다. 개인 측정 결과지는 `measurement_report`, 원문 URL은 null이므로 공개 원문 버튼을 비활성화한다.

## 평가 당시 스냅샷 계약

기존 평가는 그대로 조회할 수 있다. 다만 판정 기준 스냅샷이 없다면 기준을 재현할 수 없으므로 판정을 보류한다. **이 API는 기존 평가를 보완 저장하거나 재평가하지 않는다.** 평가 생성기가 아래 정보를 평가 당시에 저장해야 공식 참고 기준 판정이 활성화된다. 사용자가 클라이언트 요청에서 이 조건을 전달하는 엔드포인트는 제공하지 않는다.

`health_assessments.input_snapshot` 예시:

```json
{
  "body_composition": {
    "measured_at": "2026-09-17T09:00:00+09:00",
    "height_cm": "175.14",
    "weight_kg": "68.4",
    "body_fat_percentage": "32",
    "skeletal_muscle_mass_kg": "21"
  },
  "health_checkup": {
    "checkup_date": "2026-09-17",
    "fasting_glucose": "108"
  },
  "popup_context": {
    "adult_eligibility_confirmed": true,
    "sex": "female",
    "inbody_record_verified": true,
    "fasting_confirmed": true,
    "glucose_low_side_reviewed": true,
    "bp_low_side_reviewed": false
  }
}
```

`adult_eligibility_confirmed`는 평가 당시 만 19세 이상이고 임신 등 별도 기준 필요 조건이 없다고 확인되었다는 뜻이다. 확인하지 못하면 false/누락으로 저장한다. `inbody_record_verified`는 해당 기록이 InBody 결과임을 확인했다는 뜻이다. `glucose_low_side_reviewed`, `bp_low_side_reviewed`는 기관의 저혈당·저혈압 등 별도 이상 표시가 없음을 검토했다는 뜻이다. 고혈당/고혈압만 다루는 간략 구간으로 낮은 수치의 이상을 정상 처리하지 않도록 이 검토 없이는 해당 간략 판정을 적용하지 않는다.

`health_assessments.raw_result` 예시:

```json
{
  "popup_criteria": {
    "bmi": {"criteria_id": "kr-adult-bmi", "version": "verified-2026-09-17"},
    "body_fat_percentage": {"criteria_id": "inbody-public-pbf-adult-female", "version": "verified-2026-09-17"},
    "fasting_glucose": {"criteria_id": "kdca-fasting-glucose", "version": "verified-2026-09-17"},
    "skeletal_muscle_mass_kg": {
      "criteria_id": "measurement-report-reference",
      "version": "measurement-report-v1",
      "record_id": "20260916-0000-4000-8000-000000000003",
      "report_verified": true,
      "publisher": "측정기관",
      "title": "체성분 측정 결과지",
      "lower": "22",
      "upper": "30",
      "reported_status": "low"
    }
  }
}
```

골격근량 22~30은 계약 설명을 위한 합성 측정표 예시다. 서비스 공통 임계값으로 사용하면 안 된다. 측정표의 참고 범위가 없으면 `lower/upper`를 생략하고 확인된 `reported_status`만 저장한다. 제공된 범위 양끝을 포함하는 계약이다. 원문의 포함 조건이 이 계약과 다르면 구간을 임의 변환하지 말고 판정 라벨만 저장한다.

지원 기준:

| 기준 ID | 적용 지표 | 추가 조건 |
|---|---|---|
| `kr-adult-bmi` | bmi | 성인 대상 조건 확인 |
| `inbody-public-pbf-adult-male/female` | body_fat_percentage | 성인·InBody 확인, 당시 sex 일치 |
| `kdca-fasting-glucose` | fasting_glucose | 성인·공복·낮은 수치 쪽 이상 검토 |
| `kdca-blood-pressure` | systolic_bp, diastolic_bp | 성인·낮은 수치 쪽 이상 검토, 두 값 모두 존재 |
| `measurement-report-reference` | BMI·체지방률·골격근량·검진 수치 | 확인된 결과지, 평가에 연결된 record_id 일치 |

공개 참고 기준은 `verified-2026-09-17`, 측정표 기준은 `measurement-report-v1`만 지원한다. 미지원 ID·버전·예시 구간은 적용하지 않는다. 기준이 바뀌면 기존 버전 구현을 유지하거나 과거 결과의 판정을 보류해야 한다.

화면·수식·출처 상세: [팝업 설계](total-analysis-popup-spec.md).
