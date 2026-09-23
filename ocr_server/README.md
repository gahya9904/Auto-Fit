# Auto-Fit OCR 서버 (운영 중인 소스)

`https://211-233-193-159.sslip.io` 에서 돌아가는 OCR 서버 코드 그대로입니다 (v0.2.0, 2026-09-23 배포).
API 키·Bearer 토큰 등 비밀값은 넣지 않았습니다. 이름만 `.env.example` 에 있습니다.

- 연동 방법(요청·응답·오류 코드·필드 목록): [`docs/OCR_API_연동안내.md`](docs/OCR_API_연동안내.md)
- Template OCR 양식 정의: [`templates/TEMPLATES.md`](templates/TEMPLATES.md)

## 처리 흐름

```
업로드 파일 (JPEG/PNG/HEIC/PDF 앞 5쪽)
  → server/files.py        쪽마다 JPEG 로 변환 (EXIF 회전 반영, 긴 변 3000px 이하)
  → 쪽마다 두 API 동시 호출
       ocr/engines/clova_engine.py    CLOVA General  : 글자 + 좌표
       ocr/engines/clova_template.py  CLOVA Template : 양식이 맞으면 칸별 값 (공단 신·구, InBody270·770)
  → server/documents.py    문서 종류 판별 (양식 우선, 아니면 고유 단어 수)
  → 쪽별 항목 추출
       양식이 맞은 쪽 : ocr/template_fields.py  칸 값 사용, 양식에 없는 항목은 비움
       양식이 없는 쪽 : ocr/parser.py           항목명 찾기 + 같은 줄/아래 칸 값 짝짓기
  → ocr/validate.py        유효범위, 교차검증(BMI 재계산, 부호 복원, 혈압 순서)
  → server/pipeline.py     쪽 결과 합치기 → BMI 계산 보완 → 백엔드 필드명(server/field_map.py)
  → server/app.py          POST /ai/ocr, GET /health, Bearer 인증
```

## 폴더

| 폴더 | 내용 |
|---|---|
| `server/` | FastAPI 앱, 파일 변환, 파이프라인, 필드명 표 |
| `ocr/engines/` | CLOVA General·Template 호출 (EasyOCR·Upstage 는 엔진 비교 때 쓴 것) |
| `ocr/` | 파서·검증·정규화·Template 칸 변환. `score_*.py` 는 합성 데이터 채점 도구 |
| `schema/health_fields.json` | 항목 key·단위·유효범위·항목명 후보. 파서·검증이 모두 이 표를 따름 |
| `deploy/` | 네이버 클라우드 서버 설치(`setup_server.sh`), systemd 서비스, Caddy(HTTPS), PC→서버 배포(`deploy.sh`) |
| `templates/` | Template 양식 정의 기록, 샘플 이미지 만드는 스크립트 |
| `tests/regression_pdfs.py` | 실제 PDF 회귀 테스트 (아래) |
| `docs/` | 연동 안내서, 응답 샘플, 측정 결과 |

## 로컬 실행

```bash
python -m venv .venv
.venv\Scripts\pip install -r requirements-server.txt
copy .env.example .env        # 값은 팀 채널로 따로 받기
.venv\Scripts\python -m uvicorn server.app:app --port 8000
```

`http://localhost:8000/docs` 에서 파일을 올려 바로 시험할 수 있습니다.
`.env` 에 `AUTOFIT_OCR_SERVER_TOKEN` 이 없으면 인증 없이 받습니다(로컬 전용).
Template 키가 없으면 General 만으로 동작합니다.

## 배포 (네이버 클라우드, Ubuntu 24.04, s2-g3a 2vCPU/8GB)

```bash
bash deploy/deploy.sh 211.233.193.159             # 코드만 갱신
bash deploy/deploy.sh 211.233.193.159 --with-env  # .env 의 서버용 키 5개도 함께 보냄
```

- SSH 키가 있어야 합니다(팀 공유 안 함).
- 서버: `/opt/autofit-ocr`, systemd `autofit-ocr`(uvicorn workers 2, 죽으면 3초 뒤 재시작), Caddy 가 Let's Encrypt 인증서 자동 갱신.
- 업로드 파일과 추출 값은 저장하지도, 로그에 남기지도 않습니다.

## 회귀 테스트 (2026-09-23 백엔드 보고 건)

```bash
set OCR_TOKEN=<토큰>
python tests/regression_pdfs.py --inbody270 "inbody-270-result.pdf" --blank-checkup "별지6_일반건강검진_결과통보서.pdf"
```

PDF 는 저장소에 넣지 않았습니다(InBody 카탈로그는 회사 자료). 가진 파일 위치를 넣어 주세요.

**현재 서버 결과 (2026-09-23 13시)**
- ✅ InBody270 PDF: 기대값 8개 모두 일치 (Template `inbody270` 로 21칸 읽음)
- ❌ 빈 공단 결과통보서 4쪽 PDF: 기준표 숫자 8개가 값으로 나옴 → **수정 예정** (아래 알려진 문제 1)

## 보고받은 요청 반영 현황

보고서의 InBody270 오류(BMI 10.0, 체지방률 8.0, 골격근량 70.0, 점수 1)는 **v0.1.0 (General 만 사용)** 의 동작입니다.
같은 PDF 를 현재 v0.2.0 에 보내면 모두 정답입니다.

| 요청 | 상태 |
|---|---|
| 기종 판별 후 기종별 템플릿 | ✅ v0.2.0. CLOVA Template 이 양식(InBody270 / 770 / 공단 신·구)을 판별 |
| 필드별 bbox/ROI 안의 숫자만 | ✅ 위 양식은 칸 영역에서만 읽음. 양식에 없는 항목은 General 값도 버림 |
| 그래프 눈금·정상범위 제외 | ✅ 위 양식. ⚠️ 템플릿이 없는 다른 양식은 General 파서라 위험이 남음 |
| 막대그래프는 막대 끝 값 | ✅ 770: 막대 행 전체 칸(눈금 줄 제외) / 270: 신체변화 표의 이번 측정 칸 |
| 인바디점수 전용 ROI | ✅ |
| 검진표 결과 열만 | ⚠️ 공단 양식은 결과 칸만 읽지만, 칸이 비었을 때 General 값으로 채우는 규칙 때문에 빈 양식에서 기준값이 나옴 (알려진 문제 1) |
| 교차검증 → review_required | 일부. BMI ≈ 체중/신장² 은 있음. 체지방률 ≈ 체지방량/체중, 골격근량 ≤ 체중 **추가 예정** |
| 실제 PDF 회귀 테스트 | ✅ `tests/regression_pdfs.py` |

## 알려진 문제

1. **빈 양식 오탐**: 양식이 맞은 쪽에서 칸이 비어 있으면 General 값으로 채우는데, 빈 양식이면 기준표 숫자가 들어갑니다.
   설명만 있는 3·4쪽도 공단 양식으로 잘못 맞춰집니다.
   → 수정 방향: 양식이 맞은 쪽은 칸 값만 쓰고 비었으면 null. 빈 양식은 `422 NO_FIELDS_FOUND`.
2. 공단 양식의 요단백·종합판정(체크박스)은 null. 체크 표시 판별은 다음 단계.
3. 템플릿이 없는 검진표·체성분 결과지는 General 파서로 읽어 정확도가 낮습니다(합성 98장: 오탐 1.6%, 누락 10.4%).
4. 실제 촬영 결과지로는 아직 검증하지 않았습니다(합성 이미지와 카탈로그 샘플로만 측정).
