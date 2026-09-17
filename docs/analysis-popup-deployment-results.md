# 종합 분석 팝업 API 배포 검증

검증일: 2026-09-17 · 배포 코드: `ce93b5a998e9ea368fb939942c1506c391cda5c0`

| 항목 | 결과 |
|---|---|
| 서버 | `https://auto-fit-api-dev.onrender.com` |
| Render 서비스 | `auto-fit-api-dev`, Free, 기존 설정 유지 |
| 배포 | 검증한 커밋을 수동 배포, `Deploy succeeded / Live` 확인 |
| Render 배포 ID | `dep-daljhjh42hec73cn7ppg` |
| 로컬 테스트 | `backend/.venv/bin/python -m pytest backend/tests -q`: 387 passed |
| 소스 보안 | `bandit -q -r backend/app`: 발견 사항 없음 |
| 의존성 보안 | `pip_audit -r backend/requirements.txt`: 알려진 취약점 없음 |
| OpenAPI 파일 | 저장소 `docs/openapi.json`과 런타임 스키마 일치 |
| DB 변경 | 없음. 조회 전용 |

## 실제 배포 서버 확인

- `/health`: 200.
- `/docs`: 200.
- `/openapi.json`: 두 신규 GET 경로, `Health Analysis` 태그, Bearer 인증, `PopupResponse` 응답 스키마 확인.
- `/api/health-assessments/latest/popups`: 인증 없는 요청 401.
- `/api/health-assessments/{assessment_id}/popups`: 인증 없는 요청 401.

로컬 데이터 조회기를 실제 개발 Supabase DB에 연결해 기존 합성 평가 및 연결된 체성분·검진 기록을 읽는 경로도 확인했다. 지표 8개를 반환하고 기준 스냅샷이 없는 평가에서는 모든 판정을 보류했다. 사용자·평가·건강자료를 추가하거나 수정하지 않았다. 인증 정보와 건강 수치는 검증 출력에 포함하지 않았다.

## 검증 범위 및 사용 조건

배포 서버의 로그인 토큰을 사용하는 200 응답은 이번 읽기 전용 검사에서 실행하지 않았다. 인증된 응답·UUID·소유권 분리·수식·경계값·스냅샷·측정표 기준·출처 제한은 로컬 테스트로 검증했다. UI 렌더링은 이 저장소에서 구현하지 않았다.

사용자는 Swagger `Health Analysis` 그룹에서 `Authorize`에 Supabase access token을 입력한 후 최신 평가 또는 배경 화면의 평가 ID를 조회한다. 평가가 없으면 404, 기준 스냅샷이 없으면 수치는 반환하되 `판정 보류`다. 공식 참고 판정과 출처를 제공하려면 평가 생성기가 평가 당시 조건·기준 버전을 저장해야 한다. 기존 평가에 새 기준을 자동으로 보완 저장하지 않는다.

- [API 계약 및 스냅샷 형식](analysis-popup-api-contract.md)
- [화면·수식 설계](total-analysis-popup-spec.md)
