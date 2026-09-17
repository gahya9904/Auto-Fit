# 건강 문서 업로드·OCR·확정 API

Bearer 인증이 필요합니다. 각 파일은 `POST /api/health-documents`를 한 번 호출합니다. 요청은 multipart/form-data이며 `file`만 보내면 됩니다. `document_type`은 선택 입력이며 기존 클라이언트 호환용입니다. 생략하면 실제 OCR 연결 시 서버가 파일 내용으로 `health_checkup` 또는 `body_composition`을 판별하며, 임시 모드는 아래 샘플 정책을 사용합니다. 빈 문자열 대신 필드 자체를 생략하세요. PDF/PNG/JPEG(JPG)/HEIC, 최대 10 MiB(10,485,760 bytes)를 지원하며 확장자 대신 파일 시그니처로 검사합니다.

## 업로드와 조회

실제 OCR 연결 후 종류 생략 시 서버가 동기 판별·추출을 먼저 수행하고 판별된 종류로 파일과 OCR 결과를 저장합니다. 판별 불가 시 저장하지 않고 422 오류를 반환합니다. OCR URL이 없는 임시 모드에서는 실제 종류 판별을 수행하지 않습니다. 지원하는 PDF/PNG/JPEG/HEIC 파일이면 내용과 무관하게 고정 샘플을 `ocr_status=completed`, `status=awaiting_review`, `error=null`로 반환합니다. 종류 생략 시 기본 `health_checkup` 샘플을 사용합니다. 서버 환경 변수 `HEALTH_DOCUMENT_OCR_MOCK_DOCUMENT_TYPE=body_composition`으로 체성분 샘플을 테스트할 수 있으며 프론트는 계속 파일만 전송합니다. 기존 명시적 `document_type` 지정은 해당 종류 샘플을 반환합니다. 임시 응답의 document_type은 판별 결과가 아니라 샘플 종류입니다. 샘플은 파일 내용과 무관하며 건강검진 날짜·혈압·혈액검사 값과 체성분 측정 시각·근육량·체지방 값이 포함됩니다. 따라서 실제 OCR 서버 없이 POST → GET → PATCH → confirm을 호출할 수 있습니다. confirm은 수정한 샘플도 실제 DB에 저장합니다. 업로드 성공은 201, 조회 성공은 200입니다. POST와 GET 및 PATCH는 동일한 문서별 응답 스키마를 사용합니다. `document_type`을 discriminator로 타입을 구분합니다.

```json
{
  "uploaded_file_id": "20260916-0000-4000-8000-000000000002",
  "document_type": "health_checkup",
  "file_name": "checkup.pdf",
  "uploaded_at": "2026-09-17T00:00:00Z",
  "ocr_status": "completed",
  "status": "awaiting_review",
  "extracted_data": {
    "checkup_date": "2026-09-17",
    "height_cm": "175",
    "weight_kg": "70",
    "bmi": "22.9",
    "systolic_bp": 120,
    "diastolic_bp": 80
  },
  "error": null
}
```

예시는 핵심 필드만 표시했습니다. 전체 응답은 나머지 추출 필드도 null로 포함하고, 기존 클라이언트 호환용 `file`, `ocr_result`도 포함합니다. Decimal 측정값은 응답에서 **문자열 또는 null**입니다. 프론트에서 숫자 표시/계산 시 변환하세요. 정수 혈압은 number, 날짜/시각과 텍스트는 string입니다. PATCH는 Decimal에 숫자 또는 숫자 문자열을 허용합니다.

`ocr_status`: `pending`, `processing`, `completed`, `failed`. 현재 POST는 동기 처리하므로 완료 또는 실패를 반환합니다. `status`는 문서 검토 단계인 `awaiting_review`, `confirmed`, `failed`입니다. OCR 실패에도 파일 저장이 성공하면 201과 파일 ID를 반환하며 `error.code`를 확인해야 합니다. 빈 결과를 완료로 취급하지 않습니다.

## DB 필드와 단위

공통 필드: `height_cm`(cm), `weight_kg`(kg), `bmi`(kg/m²).

| 건강검진 필드 | 타입 / 단위 |
| --- | --- |
| checkup_date | date, YYYY-MM-DD; 확정 필수 |
| systolic_bp, diastolic_bp | integer, mmHg; 혈압은 두 필드로 구분 |
| fasting_glucose, total_cholesterol, hdl_cholesterol, ldl_cholesterol, triglycerides | Decimal, mg/dL |
| ast, alt, gamma_gtp | Decimal, U/L |
| hemoglobin | Decimal, g/dL |
| creatinine | Decimal, mg/dL |
| institution_name, checkup_type | string |

| 체성분 필드 | 타입 / 단위 |
| --- | --- |
| measured_at | datetime, ISO 8601; 시간대 포함 권장; 확정 필수 |
| skeletal_muscle_mass_kg, body_fat_mass_kg | Decimal, kg |
| body_fat_percentage, body_water_percentage, protein_percentage | Decimal, % |
| basal_metabolic_rate | Decimal, kcal/day |
| visceral_fat_level | Decimal, level |
| body_water_liters | Decimal, L |
| device_name | string |

모든 추출 필드는 nullable입니다. 정확한 허용 범위와 문자열 길이는 OpenAPI에 정의되어 있습니다. `exam_date`, `height`, `weight`, `blood_pressure` 같은 별칭은 허용하지 않습니다.

## 수정

`PATCH /api/health-documents/{uploaded_file_id}/ocr-result`

```json
{"extracted_data": {"weight_kg": "69.5", "total_cholesterol": null}}
```

보낸 항목만 변경하고 생략한 항목은 유지합니다. null은 값을 비웁니다. 저장된 문서 종류에 해당하는 필드만 허용하며 알 수 없는 필드/타입/범위는 422입니다. 성공 시 전체 최종 `extracted_data`를 반환합니다. 확정 후 수정은 409 `DOCUMENT_CONFIRMED`입니다. pending/processing 상태는 수정할 수 없습니다. failed 상태에서는 직접 수정할 수 있고, 성공하면 completed로 바꾸고 오류를 지웁니다.

## 재업로드와 여러 파일

재업로드는 새 POST로 **새 uploaded_file_id**를 발급합니다. 기존 문서를 교체하거나 삭제하지 않습니다. 이전 미확정 문서는 검토 대기/실패 상태로 남고, 프론트 검토 큐에서 제외하세요. confirm 전에는 분석용 건강검진/체성분 테이블에 저장되지 않습니다. 이미 확정한 기존 문서의 분석 데이터는 새 업로드로 무효화되지 않습니다.

2개 파일은 POST 2회 → ID 2개 → 검토 1/2, 2/2 → 각각 confirm으로 처리합니다. 순서는 프론트가 관리하고 파일별 실패·재시도도 독립적으로 처리합니다. 여러 파일의 확정은 하나의 일괄 트랜잭션이 아닙니다.

## 확정

`POST /api/health-documents/{uploaded_file_id}/confirm` (요청 body 없음)

completed OCR 결과의 날짜를 검증하고 `health_checkups` 또는 `body_compositions`에 저장합니다. 성공 200:

```json
{
  "uploaded_file_id": "20260916-0000-4000-8000-000000000002",
  "document_type": "health_checkup",
  "status": "confirmed",
  "health_checkup_id": "20260916-0000-4000-8000-000000000003",
  "body_composition_id": null,
  "already_confirmed": false
}
```

체성분은 반대로 `body_composition_id`를 반환합니다. 응답에는 호환용 `file`, `health_data`도 포함합니다. 순차 재호출은 기존 ID와 `already_confirmed: true`를 반환합니다. 프론트는 동일 문서에 대한 수정/확정을 동시에 호출하지 않고 확정 버튼의 중복 클릭을 방지해야 합니다. 현재 DB 저장과 업로드 상태 변경은 별도 요청이므로 서버 간 동시 요청의 원자성은 보장하지 않습니다.

## 오류

HTTP 오류는 아래 형태입니다. 입력값이나 OCR 원문을 오류에 포함하지 않습니다.

```json
{"detail": {"code": "VALIDATION_ERROR", "message": "입력값을 확인해 주세요.", "fields": ["body.extracted_data.weight_kg"]}}
```

| HTTP | code | 상황 |
| --- | --- | --- |
| 401 | AUTH_REQUIRED | 인증 실패/만료 |
| 404 | DOCUMENT_NOT_FOUND | 파일 ID 없음 또는 다른 사용자 소유 |
| 409 | DOCUMENT_CONFIRMED | 확정 문서 수정 |
| 409 | OCR_NOT_READY | OCR 처리 중 수정/확정, 실패 결과 확정 |
| 413 | FILE_TOO_LARGE | 파일 10 MiB 초과 |
| 415 | UNSUPPORTED_FILE_TYPE | 지원하지 않는 파일 시그니처 |
| 422 | VALIDATION_ERROR | 문서 종류/필드/범위/확정 날짜 검증 실패 |
| 422 | UNKNOWN_DOCUMENT / UNSUPPORTED_DOCUMENT | 실제 OCR 연결 시 종류 판별 불가 또는 지원하지 않는 문서; 저장하지 않음 |
| 502 | OCR_FAILED / OCR_INVALID_RESPONSE / OCR_NOT_CONFIGURED | 자동 판별 서버 실패/잘못된 응답/설정 없음; 저장하지 않음 |
| 502 | DATA_SOURCE_ERROR | 저장소/DB 응답 실패 |

문서 종류가 결정된 이후 추출 오류는 저장된 문서를 조회할 수 있도록 HTTP 201/200 응답의 `ocr_status=failed`, `error`로 전달합니다. 코드: `OCR_NOT_CONFIGURED`(처리 서버 설정 없음 및 샘플 모드 비활성), `OCR_FAILED`(처리 서버 실패/타임아웃), `DOCUMENT_TYPE_MISMATCH`(종류 불일치), `EXTRACTION_FAILED`(추출 데이터 없음 또는 스키마 검증 실패).

## 서버 OCR 연결 설정

`HEALTH_DOCUMENT_OCR_URL`은 신뢰할 수 있는 내부 OCR 어댑터의 URL입니다. 선택 설정 `HEALTH_DOCUMENT_OCR_TOKEN`은 이 서버에만 Bearer 토큰으로 전달합니다. Supabase 키나 사용자 인증 토큰은 전달하지 않습니다. 서버는 원본 파일을 multipart로 전송하며 최대 60초 대기합니다. 자동 판별 요청에는 document_type을 보내지 않고 판별·추출을 한 번에 요청합니다. 기존 명시적 지정 요청에만 document_type을 전달합니다. unknown/unsupported 문서는 어댑터가 422를 반환하거나 document_type=unknown/unsupported를 반환해야 합니다. 별도 판별 실패 시 클라이언트에 422를 반환하며 임의 종류로 대체하지 않습니다. 어댑터는 다음 JSON을 반환해야 합니다.

```json
{"document_type": "health_checkup", "extracted_data": {"checkup_date": "2026-09-17", "weight_kg": "70"}}
```

`HEALTH_DOCUMENT_OCR_MOCK_ENABLED`는 기본 `true`입니다. URL이 없을 때만 샘플을 사용하며, `false`로 설정하면 기존처럼 `OCR_NOT_CONFIGURED`를 반환합니다. 실제 URL이 설정되어 있으면 샘플 설정과 무관하게 실제 OCR을 호출하고, 실제 호출 실패를 샘플로 대체하지 않습니다.

서버가 준비되면 `HEALTH_DOCUMENT_OCR_URL=https://<실제 서버>/ai/ocr`와 필요한 토큰을 설정합니다. 위 응답 형식과 다른 실제 서버 응답은 내부 OCR 어댑터에서 DB 필드명으로 매핑하면 됩니다. 프론트의 네 경로와 요청·응답 스키마는 유지합니다. 현재 ai 브랜치의 `fields/extracted_text` 응답은 이 정규화 형식과 다르므로 실제 서버 완성 시 내부 매핑이 필요합니다.

OCR 엔진 자체는 저장소에 포함되지 않습니다. 샘플 데이터는 실제 파일 판독 결과가 아닙니다. 기존 필수 document_type 버전은 공유 개발 서버에서 검증했습니다. 이 문서의 자동 판별 변경은 로컬 구현·검증 기준이며 이전 배포 검증이 새 계약의 배포를 의미하지 않습니다. [배포·검증 결과](health-documents-deployment-results.md)를 참고하세요.
