# 건강 문서 API 배포·실연동 검증

2026-09-17 공유 개발 FastAPI 서버에 문서별 응답 스키마와 임시 OCR 결과를 배포했다.

- API: https://auto-fit-api-dev.onrender.com
- Swagger: https://auto-fit-api-dev.onrender.com/docs
- 배포 커밋: [d32ff94](https://github.com/gahya9904/Auto-Fit/commit/d32ff94d505434d7317c32a2443d2dfd561db30b)
- Render: [성공한 수동 배포](https://dashboard.render.com/web/srv-dafmuen40ujc73c0ermg/deploys/dep-dalmsd6k1f9s738ppa3g), 59.8초
- GitHub CI: [Backend security 성공](https://github.com/gahya9904/Auto-Fit/actions/runs/35181675865)

첫 배포는 빌드·앱 초기화 이후 트래픽 전환 대기가 계속되어 12분 42초에 취소했다.
코드나 환경 설정을 변경하지 않고 같은 커밋으로 재시도했고 배포가 성공했다.
첫 시도의 지연 원인은 확정하지 않았다.

| 검증 | 결과 |
| --- | --- |
| 배포 커밋만 추출한 환경의 백엔드 테스트 | 435개 통과 |
| backend/app Bandit | 통과 |
| GitHub audit·secrets 검사 | 성공 |
| Render 내부 /health 검사 | 200 |
| 실제 배포 API + 개발 Supabase + Storage | 26개 검사 통과 |
| 테스트 사용자 소유 파일·검진·체성분·프로필·알림 설정 DB 행 | 정리 후 0건 |
| 테스트 파일 ID의 OCR DB 행 | 정리 후 0건 |

실연동 검증에는 이번 실행에서 생성한 합성 사용자 하나와 합성 PDF 두 개만 사용했다.
`health_checkup`, `body_composition` 각각 POST → GET → PATCH → confirm을 호출했고,
수정한 체중이 실제 DB에 저장되는 것과 생성 ID를 확인했다. 반복 confirm은 동일 ID를 반환했고,
확정된 문서 PATCH는 409 DOCUMENT_CONFIRMED를 반환했다. 미인증·없는 문서·지원하지 않는 파일의
구조화된 오류와 두 파일의 독립 ID도 확인했다. 테스트 계정은 계정 삭제 API로 정리했으며
기존 사용자 자료는 테스트 대상으로 사용하지 않았다.

현재 OCR URL이 설정되지 않아 문서 종류별 고정 샘플을 `ocr_status=completed`로 반환한다.
실제 파일 내용을 판독한 값이 아니며 confirm하면 검토·수정한 샘플도 DB에 저장된다.
실제 OCR 서버가 준비되면 내부 호출·응답 매핑을 교체하고 프론트의 네 API 계약은 유지한다.

프론트 호출 목록:

```text
BASE_URL: https://auto-fit-api-dev.onrender.com
POST  /api/health-documents
GET   /api/health-documents/{uploaded_file_id}
PATCH /api/health-documents/{uploaded_file_id}/ocr-result
POST  /api/health-documents/{uploaded_file_id}/confirm
```

로그인 Bearer 토큰이 필요하다. 입력·응답 예시는 [건강 문서 API](health-documents-api.md)를 참고한다.

개발 환경에서만 재실행:

```bash
backend/.venv/bin/python -m backend.tests.health_documents_live \
  --api-base https://auto-fit-api-dev.onrender.com
```

이 명령은 합성 계정·파일·건강 데이터를 생성하고 이번 실행의 데이터만 정리한다.
연결된 개발 프로젝트를 검증하며 키·비밀번호·토큰·응답 본문을 출력하지 않는다.
DB 스키마 변경이나 실제 OCR 엔진 배포는 이번 작업에 포함하지 않았다.

## 파일만 업로드하는 임시 샘플 정책 배포 (2026-09-17 14:39 KST)

- 배포 커밋: [8de4e66](https://github.com/gahya9904/Auto-Fit/commit/8de4e661e200369427aba4fd0ef5d43f0f8db75e)
- Render: [Deploy succeeded / Live](https://dashboard.render.com/web/srv-dafmuen40ujc73c0ermg/deploys/dep-dalnpr6k1f9s738sneo0), 1분 4초
- 작업 환경 백엔드 테스트: 458개 통과.
- 실제 배포 API + 개발 Supabase + Storage: 30개 검사 통과.

POST 요청의 필수 필드는 file만이며 document_type은 선택이다. PDF와 이미지 모두 종류를
판별하지 않고 샘플을 반환한다. 현재 개발 서버는 종류 생략 시 건강검진 샘플을 반환한다.
체성분 샘플은 명시적 document_type=body_composition으로 검증했다. 서버 측
HEALTH_DOCUMENT_OCR_MOCK_DOCUMENT_TYPE 설정으로 기본 샘플 종류를 바꿀 수 있다.
실제 OCR 서버 연결 후에는 생략된 종류를 OCR 어댑터가 판별하며 unknown/unsupported 오류를
반환한다. 지금 반환되는 종류와 수치는 실제 문서 판독 결과가 아니다.

합성 계정 하나로 종류 없는 PNG 업로드, 종류 없는 PDF 업로드 후 GET → PATCH → confirm,
체성분 검토·확정, 수정 체중의 DB 저장, 확정 재호출의 동일 ID, 확정 후 수정 409와 파일별
독립 ID를 확인했다. 테스트 계정과 생성 파일·OCR·건강 데이터는 정리 후 잔존 행 0건을 확인했다.
첫 검증은 이미지 추가에 따라 파일이 3개로 늘었는데 스크립트의 ID 개수 검사가 2개로 남아
실패했다. API 동작 검사는 통과했고 테스트 데이터를 정리했다. 개수 검사를 3개로 수정한 뒤
재실행하여 30개 검사를 모두 통과했다. 앱 코드나 배포 설정 변경은 필요하지 않았다.
