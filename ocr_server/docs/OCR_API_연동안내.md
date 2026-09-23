# AutoFit OCR API 연동 안내

> 작성: 이승현 (AI·Data) · 2026-09-18 · 버전 0.2.2 · 2026-09-23 서버 주소 고정 (네이버 클라우드) · 2026-09-23 Template OCR 추가 · 2026-09-23 빈 양식 오탐 수정 · 2026-09-23 체성분 합계 검사
> 대상: 백엔드 (김현호)
> OCR 엔진: **NAVER CLOVA OCR (Template + General)** + 항목 추출 파서
> 소스: https://github.com/gahya9904/Auto-Fit/tree/ocr/ocr_server

**0.2.2 변경점 (백엔드 수정 필요 없음)**
- 인바디 항목이 옆 줄 값으로 섞여 읽히는 경우(예: 체지방량 ↔ 체수분)를 잡는 **체성분 합계 검사**를 추가했습니다. 어긋나면 관련 필드가 `review_required`에 들어갑니다.
  - 체수분 + 단백질 + 무기질 ≈ 제지방량, 제지방량 + 체지방량 ≈ 체중 (0.5kg 넘게 차이 나면)
  - 체수분 ÷ 제지방량 = 68~78%
- 어느 값이 틀렸는지는 계산만으로 알 수 없어, 관계된 필드를 함께 올립니다. 합성 98장에서 경고가 뜬 사진 8장은 모두 실제로 틀린 값이 있는 사진이었습니다(맞는 사진에 경고 0장).

**0.2.1 변경점 (2026-09-23 백엔드 보고 반영, 백엔드 수정 필요 없음)**
- 값을 적지 않은 공단 결과통보서를 올리면 기준표 숫자를 결과로 돌려주던 문제를 고쳤습니다. 이제 **`422 NO_FIELDS_FOUND`** 입니다.
  - 양식이 맞은 쪽은 **양식 칸의 값만** 씁니다. 칸이 비어 있으면 `null`입니다(다른 방식으로 채우지 않음).
- 교차검증 2개를 추가했습니다. 어긋나면 관련 필드가 `review_required`에 들어갑니다.
  - 체지방률 ≈ 체지방량 ÷ 체중 × 100 (1%p 넘게 차이 나면)
  - 골격근량·체지방량 < 체중
- 보고하신 InBody270 오류(BMI 10.0 등)는 0.1.0 서버의 동작이었습니다. 0.2.0부터는 같은 PDF에서 8개 모두 정답입니다.
- 회귀 테스트: 소스의 `tests/regression_pdfs.py` (InBody270 PDF, 빈 공단 양식 PDF 둘 다 통과)

**0.2.0 변경점 (백엔드 수정 필요 없음)**
- 공단 결과통보서(2026 개정판·개정 전)와 InBody270·770 결과지는 **양식 칸 위치로 읽습니다(Template OCR).** 그 밖의 결과지는 지금처럼 General OCR로 읽습니다.
- 요청·응답 구조와 필드명은 **그대로**입니다. `meta`에 `templates`, `template_field_count`가 추가되고 `meta.engine` 값이 `clova-template+general`로 바뀝니다.
- 공단 결과통보서에는 BMI 숫자가 인쇄되지 않아서, 신장·체중으로 **계산한 BMI**를 넣어 드립니다.

**요약**
- 요청 방식(multipart로 `file` 보내기)과 응답 구조(`document_type` + `extracted_data`, 못 읽은 값은 `null`)는 **백엔드가 기대하신 형태 그대로**입니다.
- 필드명은 예시로 주신 `checkup_date`, `height_cm`, `weight_kg`, `fasting_glucose`를 그대로 쓰고, 나머지 항목도 같은 규칙으로 지었습니다. 전체 목록은 [부록 A](#부록-a-필드-목록)에 있습니다.
- 추가로 `field_confidence`, `review_required`, `meta`를 보냅니다. 쓰지 않으셔도 연동에는 문제없습니다.
- ai 브랜치에 있는 빈 `POST /ai/ocr`와 **경로가 같습니다.** 백엔드 내부 OCR 호출 주소만 바꾸면 프론트 API 계약은 그대로 유지됩니다.

---

## 1. 호출 정보

| 항목 | 값 |
|---|---|
| 서버 URL | **`https://211-233-193-159.sslip.io`** (네이버 클라우드 고정 주소, 24시간 운영) |
| API 경로 | `POST /ai/ocr` |
| 상태 확인 | `GET /health` → `{"status":"ok","engine":"clova-template+general"}` |
| Swagger 문서 | `GET /docs` (브라우저에서 파일을 올려 바로 시험 가능) |
| 인증 | 서버 간 **Bearer 토큰**. 헤더 `Authorization: Bearer <토큰>`. 토큰은 코드·채팅이 아닌 별도 경로로 전달합니다 |

- 토큰은 필수입니다. 없거나 틀리면 `401 UNAUTHORIZED`를 돌려줍니다.
- 네이버 클라우드 서버(2코어·8GB)에서 24시간 돌아갑니다. 테스트 시간을 맞추실 필요가 없습니다. 서버가 멈추면 3초 뒤 자동으로 다시 켜지고, 재부팅해도 자동으로 시작됩니다.
- 이전 임시 주소(`...trycloudflare.com`)는 더 이상 쓰지 않습니다. 경로·요청·응답 형식과 토큰은 그대로입니다.
- 운영 기간: 인공지능사관학교 클라우드 지원 기간(2026-12-10)까지. 이후 주소가 바뀌면 다시 공유합니다.

## 2. 요청 형식

- `Content-Type: multipart/form-data`

| 필드 | 필수 | 설명 |
|---|---|---|
| `file` | ✅ | 결과지 파일 1개 (JPEG / PNG / HEIC / PDF, 20MB 이하) |
| `document_type` | 선택 | `health_checkup` 또는 `body_composition`. **비우면 자동 판별**합니다 |

**curl 예시**
```bash
curl -X POST "$OCR_URL/ai/ocr" \
  -H "Authorization: Bearer $OCR_TOKEN" \
  -F "file=@checkup.jpg" \
  -F "document_type=health_checkup"
```

**FastAPI 백엔드 예시 (httpx)**
```python
import httpx

async def call_ocr(file_bytes: bytes, filename: str, document_type: str | None):
    data = {"document_type": document_type} if document_type else {}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{OCR_URL}/ai/ocr",
            headers={"Authorization": f"Bearer {OCR_TOKEN}"},
            files={"file": (filename, file_bytes)},
            data=data,
        )
    return r.status_code, r.json()   # 실패도 항상 JSON (아래 3-3)
```

## 3. 응답 샘플

아래 샘플은 **합성 결과지를 실제 서버에 보내서 받은 응답**입니다(가상 인물). 전체 파일은 `docs/samples/`에 있습니다.
3-1·3-2는 0.1.0 서버에서 받은 응답이라 `meta.engine`이 `clova-general`로 적혀 있습니다. 지금 서버는 `clova-template+general`로 보냅니다.

### 3-1. 건강검진 성공 (HTTP 200) — `samples/success_health_checkup.json`
```json
{
  "document_type": "health_checkup",
  "extracted_data": {
    "checkup_date": "2025-06-09",
    "sex": "M",
    "age": 38,
    "height_cm": 192.1,
    "weight_kg": 64.5,
    "bmi": 17.5,
    "waist_cm": 64.9,
    "systolic_bp": null,
    "diastolic_bp": null,
    "fasting_glucose": 103,
    "total_cholesterol": 191,
    "triglycerides": 69,
    "hdl_cholesterol": 53,
    "ldl_cholesterol": 124,
    "ast": 20,
    "alt": 25,
    "gamma_gtp": 38,
    "hemoglobin": 15.2,
    "serum_creatinine": 0.97,
    "egfr": 87,
    "urine_protein": "음성",
    "vision": "0.7/1.1",
    "overall_verdict": "정상B(경계)",
    "checkup_center": "한울종합검진센터"
  },
  "field_confidence": { "checkup_date": 0.889, "fasting_glucose": 1.0, "systolic_bp": 0.0, "...": "항목마다 0~1" },
  "review_required": [],
  "meta": {
    "engine": "clova-general",
    "file_type": "jpeg",
    "pages_total": 1,
    "pages_read": 1,
    "pages_used": [1],
    "requested_document_type": null,
    "detected_document_type": "health_checkup",
    "extracted_count": 22,
    "field_count": 24,
    "elapsed_ms": 3356,
    "warnings": []
  }
}
```
이 샘플에서 혈압 두 칸은 읽지 못해 `null`입니다. 실제로 자주 발생하는 경우라 그대로 두었습니다.
(이 샘플은 General OCR로 읽는 합성 양식입니다. 공단 공식 양식은 아래 3-1b처럼 Template OCR로 읽습니다.)

### 3-1b. 공단 결과통보서 2쪽 (HTTP 200) — `samples/success_health_checkup_nhis_form.json`
합성 인물 값을 공식 양식에 적고 촬영 조건(원근)을 입힌 이미지를 Template OCR로 읽은 응답입니다. InBody770 결과지 응답은 `samples/success_body_composition_inbody770.json`에 있습니다.
```json
{
  "document_type": "health_checkup",
  "extracted_data": {
    "checkup_date": null, "sex": null, "age": null,
    "height_cm": 172.3, "weight_kg": 48.9, "bmi": 16.5, "waist_cm": 60.9,
    "systolic_bp": 132, "diastolic_bp": 83,
    "fasting_glucose": 94, "total_cholesterol": 173, "triglycerides": 94,
    "hdl_cholesterol": 67, "ldl_cholesterol": 87,
    "ast": 17, "alt": 22, "gamma_gtp": 36,
    "hemoglobin": 13.5, "serum_creatinine": 0.95, "egfr": 81,
    "urine_protein": null, "vision": "1.4/0.8",
    "overall_verdict": null, "checkup_center": null
  },
  "review_required": [],
  "meta": {
    "engine": "clova-template+general",
    "templates": ["nhis2026_p2"],
    "template_field_count": 17,
    "detected_document_type": "health_checkup",
    "extracted_count": 18, "field_count": 24, "elapsed_ms": 4952, "...": "..."
  }
}
```
- 검진일은 1쪽에 있습니다. 1쪽과 2쪽을 **PDF 한 파일**로 보내시면 두 쪽 값을 합쳐 드립니다.
- `bmi`는 양식에 숫자 칸이 없어 신장·체중으로 계산한 값입니다.
- 공단 양식에 없는 `sex`·`age`는 `null`입니다(주민번호는 읽지 않습니다, 기획서 5.6).
- `urine_protein`·`overall_verdict`는 양식에서 **체크박스(□)** 로 표시합니다. 체크 인식은 아직 없어 `null`입니다(틀린 값을 넣지 않기 위해 비워 둠).

### 3-2. 인바디 성공 (HTTP 200) — `samples/success_body_composition.json`
```json
{
  "document_type": "body_composition",
  "extracted_data": {
    "measured_date": "2025-03-13",
    "sex": "M",
    "age": 44,
    "height_cm": 175.6,
    "weight_kg": 52.8,
    "bmi": 17.1,
    "body_fat_pct": 4.0,
    "skeletal_muscle_kg": null,
    "basal_metabolic_rate_kcal": null,
    "body_fat_mass_kg": 2.1,
    "fat_free_mass_kg": 50.7,
    "total_body_water_l": 37.1,
    "protein_kg": 9.9,
    "mineral_kg": 3.65,
    "waist_hip_ratio": 0.78,
    "visceral_fat_level": 5,
    "body_composition_score": 11,
    "target_weight_kg": 67.8,
    "weight_control_kg": 15.0,
    "fat_control_kg": -0.3,
    "muscle_control_kg": 6.0,
    "segmental_muscle_right_arm_pct": null,
    "segmental_muscle_left_arm_pct": 113.8,
    "segmental_muscle_trunk_pct": null,
    "segmental_muscle_right_leg_pct": 116.0,
    "segmental_muscle_left_leg_pct": null
  },
  "field_confidence": { "body_fat_pct": 0.742, "weight_kg": 1.0, "...": "항목마다 0~1" },
  "review_required": ["body_fat_pct", "fat_free_mass_kg", "target_weight_kg", "weight_control_kg",
                      "fat_control_kg", "muscle_control_kg",
                      "segmental_muscle_left_arm_pct", "segmental_muscle_right_leg_pct"],
  "meta": { "file_type": "jpeg", "detected_document_type": "body_composition", "extracted_count": 21, "field_count": 26, "elapsed_ms": 4696, "...": "..." }
}
```
⚠️ 이 샘플의 `body_composition_score`는 **틀린 값**입니다(정답 81). 알려진 약점은 5번 아래 표에 정리했습니다. 저장 전에 반드시 사용자 검수를 거쳐야 하는 이유입니다.

### 3-3. 판독 실패

실패할 때도 **항상 같은 구조의 JSON**을 돌려줍니다. HTTP 상태 코드와 `error.code`로 구분하시면 됩니다.

```json
{
  "document_type": null,
  "extracted_data": null,
  "error": {
    "code": "UNSUPPORTED_DOCUMENT",
    "message": "건강검진 결과지나 체성분 결과지로 인식되지 않았습니다. 직접 입력해 주세요."
  }
}
```

| HTTP | `error.code` | 언제 | 프론트 권장 처리 |
|---|---|---|---|
| 400 | `INVALID_REQUEST` | `file` 필드 누락 등 요청 형식 오류 | 백엔드 버그 |
| 400 | `EMPTY_FILE` | 빈 파일 | 다시 선택 |
| 400 | `CORRUPTED_FILE` | 깨진 파일, 암호 걸린 PDF | 다시 선택 |
| 400 | `INVALID_DOCUMENT_TYPE` | `document_type`이 정해진 두 값이 아님 | 백엔드 버그 |
| 401 | `UNAUTHORIZED` | 토큰 없음 또는 틀림 | 백엔드 설정 확인 |
| 413 | `FILE_TOO_LARGE` | 20MB 초과 | 용량 안내 |
| 415 | `UNSUPPORTED_FILE_TYPE` | JPEG·PNG·HEIC·PDF가 아님 | 형식 안내 |
| 422 | `UNSUPPORTED_DOCUMENT` | 검진표·인바디가 아닌 문서 (예: 처방전) | **수동 입력으로 전환** |
| 422 | `DOCUMENT_TYPE_MISMATCH` | 보낸 `document_type`과 실제 문서가 다름 | 문서 종류 다시 선택 |
| 422 | `NO_FIELDS_FOUND` | 문서는 맞지만 읽힌 값이 0개 (값을 적지 않은 빈 양식 포함) | 재촬영 또는 수동 입력 |
| 502 | `OCR_ENGINE_ERROR` | CLOVA 호출 실패 | 잠시 후 재시도 |
| 504 | `OCR_TIMEOUT` | CLOVA 응답 지연 | 잠시 후 재시도 |
| 500 | `INTERNAL_ERROR` | 그 밖의 서버 오류 | 재시도 후 AI 담당에게 공유 |

실패 샘플 파일: `samples/fail_unsupported_document.json`, `fail_document_type_mismatch.json`, `fail_unsupported_file_type.json`

## 4. 지원 범위

| 형식 | 지원 | 비고 |
|---|---|---|
| JPEG | ✅ | 폰 사진의 회전 정보(EXIF)를 반영해 똑바로 세운 뒤 읽음 |
| PNG | ✅ | |
| HEIC / HEIF | ✅ | 아이폰 기본 사진. 서버에서 JPEG로 변환 |
| PDF | ✅ | 아래 참고 |
| 그 밖 (TIFF, WEBP, HWP, …) | ❌ | `415 UNSUPPORTED_FILE_TYPE` |

- 파일 크기: 20MB 이하. 긴 변이 3,000px를 넘으면 줄여서 읽습니다.
- 형식은 확장자가 아니라 **파일 내용**으로 판단합니다. 확장자가 틀려도 동작합니다.

**여러 페이지 PDF 처리 방식**
1. 앞 **5쪽까지** 읽습니다. 넘는 쪽은 `meta.warnings`에 안내가 들어갑니다.
2. 쪽마다 문서 종류를 판별합니다. **해당 종류로 확인된 쪽만** 합칩니다.
   - 예: 검진표 1쪽 + 처방전 1쪽 PDF → 검진표 쪽만 사용합니다. 처방전 쪽 값이 섞여 들어가는 것을 막기 위해서입니다.
3. 같은 항목이 여러 쪽에 있으면 신뢰도가 가장 높은 값을 씁니다.
4. 어느 쪽을 썼는지는 `meta.pages_used`에 1부터 센 번호로 들어갑니다.
5. 파일 하나에는 문서 한 종류를 권장합니다. 검진표와 인바디가 같은 수로 섞여 있으면 `UNSUPPORTED_DOCUMENT`가 납니다. 이때는 `document_type`을 보내 주세요.

**양식별 읽는 방식**

| 결과지 | 방식 | 읽는 항목 |
|---|---|---|
| 공단 일반건강검진 결과통보서 (2026 개정판 / 개정 전) | Template (칸 위치) | 1쪽: 검진일 · 2쪽: 신장·체중·허리둘레·혈압·시력·혈액검사 11종 (+ BMI 계산) |
| InBody270 결과지 | Template | 21개 (부위별 근육 %는 270 결과지에 인쇄되지 않음) |
| InBody770 결과지 | Template | 24개 (복부지방률·내장지방레벨은 770 결과지에 없음) |
| 그 밖의 검진표·체성분 결과지 | General (글자 + 항목명 찾기) | 부록 A 전체 중 찾은 것 |

- 양식이 맞으면 **양식 칸의 값만** 씁니다. 칸이 비었거나 양식에 없는 항목은 `null`입니다.
- 어느 양식으로 읽었는지는 `meta.templates`(쪽마다, 양식이 없으면 `null`)에 들어갑니다.

## 5. 자동 판별 (건강검진 / 인바디)

**가능합니다.** `document_type`을 비우고 파일만 보내면 됩니다.
- 방식: 위 양식에 맞으면 양식으로 판별하고, 아니면 OCR로 읽은 글자에서 문서별 고유 단어를 셉니다(예: "공복혈당"·"결과통보서" / "골격근량"·"기초대사량").
- 결과가 애매하면 추측하지 않고 `UNSUPPORTED_DOCUMENT`를 돌려줍니다.
- 실측: 실생활 촬영 조건 합성 이미지 98장에서 **98/98 정답**. 기획서 목표는 95% 이상입니다.
- `document_type`을 함께 보내면 교차 확인합니다. 실제 문서와 다르면 `422 DOCUMENT_TYPE_MISMATCH`가 납니다.
- 판별 결과는 `meta.detected_document_type`에 들어갑니다.

## 6. 처리 시간

| 경우 | 보통 | 최대 (실측) |
|---|---|---|
| 사진 1장 (서버 경유 실측 20장) | 평균 **3.9초**, 중앙값 3.7초 | 5.0초 (20장 중 1장이 5초 초과) |
| 사진 1장 (CLOVA 호출 98회) | 평균 4.2초 | 약 10초 |
| PDF 3쪽 | 약 14초 | — |

- **백엔드 호출 타임아웃은 60초를 권장합니다.** PDF 5쪽까지 고려한 값입니다.
- 사용자 화면에서는 "읽는 중" 표시가 필요합니다.
- 시간은 대부분 CLOVA 응답 대기입니다. 서버 자체 처리(이미지 변환·항목 추출)는 최대 약 2초입니다.

## 7. 값 규칙 (백엔드 매핑용)

| 규칙 | 내용 |
|---|---|
| 날짜 | `"YYYY-MM-DD"` 문자열 |
| 숫자 | JSON 숫자. 정수 항목은 정수, 소수 항목은 소수 |
| 단위 | 필드명 끝의 단위로 고정 (`_cm`, `_kg`, `_pct` …). 단위 변환은 없음 |
| 성별 | `"M"` 또는 `"F"` |
| 못 읽은 값 | `null`. 모든 필드는 항상 응답에 들어 있음 (키가 빠지지 않음) |
| 신뢰도 | `field_confidence[필드]` 0~1. `null`인 항목은 0.0 |
| 검수 필요 | `review_required`: 값은 채웠지만 신뢰도가 0.5~0.85인 항목, 또는 교차검증(BMI 재계산, 체지방률 재계산, 골격근량·체지방량 < 체중, 체성분 합계, 혈압 순서)이 어긋난 항목. **검수 화면에서 강조 표시 권장** |
| 신뢰도 0.5 미만 | 값을 채우지 않고 `null` (기획서 5.3 "모르면 비워둔다") |
| 돌려주지 않는 값 | 이름·생년월일·주민번호 (기획서 5.6 최소 수집) |

## 현재 정확도와 알려진 한계 (연동 시 참고)

**공단 공식 양식 (Template OCR, 2026-09-23 측정)**
- 합성 인물 15명의 값을 공식 결과통보서 양식에 적고, 촬영 조건 7종을 입힌 90장(1쪽 45 · 2쪽 45)으로 측정했습니다.

| 지표 | General만 (이전) | Template + General (현재) |
|---|---|---|
| 인쇄된 숫자·날짜 항목 정답 | 524/810 (64.7%) | **810/810 (100%)** |
| 틀린 값을 채움 (오탐) | 207건 | **0건** |
| 양식에 없는 항목을 채움 | 140건 | **0건** |
| 체크박스 항목 (요단백·종합판정) | 틀린 값 45건 | `null` (체크 인식 예정) |

- InBody270·770은 결과지 샘플이 1장씩이라 샘플로만 확인했습니다(270: 21/21, 770: 24/24 정답).

**그 밖의 합성 양식 (General OCR)**
- 합성 결과지를 실생활 촬영처럼 만든 98장으로 측정했습니다.
- 조건 7종: 기울어짐 · 조명 · 그림자 · 원근 · 접힘 · 흐림 · 복합.
- 기준: 기획서 7.1 필수 지표.

| 지표 | 목표 | 현재 |
|---|---|---|
| 오탐률 (틀린 값을 채움) | 2% 이하 | **1.6% ✅** |
| 누락률 (못 읽어 null) | 3% 이하 | 10.4% ❌ |
| 숫자 완전일치율 | 95% 이상 | 88.2% ❌ |
| 항목 탐지 F1 | 95% 이상 | 93.0% ❌ |

- 자주 `null`이 되는 항목: 혈압(수축기·이완기), 부위별 근육(`segmental_*`), 골격근량·기초대사량(일부 사진).
- 가끔 틀리는 항목: `body_composition_score`, 부위별 근육.
- 흐린 사진과 여러 문제가 겹친 사진에서 누락이 가장 많습니다.
- **실제 결과지 촬영본 검증은 아직 하지 않았습니다.** 기획서의 실촬영 90장 정답셋으로 측정할 예정입니다.
- 정확도 개선은 **응답 구조를 바꾸지 않고** 서버 안에서만 진행합니다. 백엔드 쪽 수정은 필요 없습니다.

## 개인정보 처리

- 업로드 파일과 추출 값은 OCR 서버에 **저장하지 않고**, 로그에도 남기지 않습니다. 메모리에서 처리한 뒤 버립니다.
- OCR 서버는 네이버 클라우드 한국 리전(KR-1)에서 운영하며, 통신은 HTTPS로 암호화됩니다.
- 이미지는 판독을 위해 **네이버 클라우드 CLOVA OCR(General·Template)로 전송**됩니다. 기획서 5.6 "외부 전송 범위 명시" 항목에 반영이 필요합니다.

---

## 부록 A. 필드 목록

### health_checkup
| 필드 | 의미 | 단위·형식 |
|---|---|---|
| checkup_date | 검진일 | YYYY-MM-DD |
| sex | 성별 | M / F |
| age | 나이 | 세 |
| height_cm | 신장 | cm |
| weight_kg | 체중 | kg |
| bmi | 체질량지수 | kg/m² |
| waist_cm | 허리둘레 | cm |
| systolic_bp | 수축기 혈압 | mmHg |
| diastolic_bp | 이완기 혈압 | mmHg |
| fasting_glucose | 공복혈당 | mg/dL |
| total_cholesterol | 총콜레스테롤 | mg/dL |
| triglycerides | 중성지방 | mg/dL |
| hdl_cholesterol | HDL 콜레스테롤 | mg/dL |
| ldl_cholesterol | LDL 콜레스테롤 | mg/dL |
| ast | AST | U/L |
| alt | ALT | U/L |
| gamma_gtp | 감마지티피 | U/L |
| hemoglobin | 혈색소 | g/dL |
| serum_creatinine | 혈청 크레아티닌 | mg/dL |
| egfr | 신사구체여과율 | mL/min/1.73m² |
| urine_protein | 요단백 | 음성 / 약양성 / 양성 |
| vision | 시력 (좌/우) | 문자열, 예: "1.0/0.8" |
| overall_verdict | 종합판정 | 정상A / 정상B(경계) / 일반 질환의심 / 유질환자 |
| checkup_center | 검진기관 | 문자열 |

### body_composition
| 필드 | 의미 | 단위·형식 |
|---|---|---|
| measured_date | 측정일 | YYYY-MM-DD |
| sex | 성별 | M / F |
| age | 나이 | 세 |
| height_cm | 신장 | cm |
| weight_kg | 체중 | kg |
| bmi | 체질량지수 | kg/m² |
| body_fat_pct | 체지방률 | % |
| skeletal_muscle_kg | 골격근량 | kg |
| basal_metabolic_rate_kcal | 기초대사량 | kcal |
| body_fat_mass_kg | 체지방량 | kg |
| fat_free_mass_kg | 제지방량 | kg |
| total_body_water_l | 체수분 | L |
| protein_kg | 단백질 | kg |
| mineral_kg | 무기질 | kg |
| waist_hip_ratio | 복부지방률 | 비율, 예: 0.85 |
| visceral_fat_level | 내장지방 레벨 | 정수 |
| body_composition_score | 종합 점수 | 점 |
| target_weight_kg | 적정 체중 | kg |
| weight_control_kg | 체중 조절량 | kg (음수 = 감량) |
| fat_control_kg | 지방 조절량 | kg (음수 = 감량) |
| muscle_control_kg | 근육 조절량 | kg |
| segmental_muscle_right_arm_pct | 오른팔 근육 | % (표준 대비) |
| segmental_muscle_left_arm_pct | 왼팔 근육 | % (표준 대비) |
| segmental_muscle_trunk_pct | 몸통 근육 | % (표준 대비) |
| segmental_muscle_right_leg_pct | 오른다리 근육 | % (표준 대비) |
| segmental_muscle_left_leg_pct | 왼다리 근육 | % (표준 대비) |

- 검진표 항목별 판정란(예: "공복혈당 주의")은 아직 추출하지 않습니다. 현재는 종합판정(`overall_verdict`)만 제공합니다.
- 기획서 4.2의 규칙 R-002, R-004가 항목별 혈당 판정을 조건으로 쓰므로, 필요하시면 알려 주세요. 다음 버전에 추가하겠습니다.
