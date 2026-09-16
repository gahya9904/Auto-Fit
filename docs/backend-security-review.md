# Auto-Fit 백엔드 보안 점검

점검일: 2026-09-14. 범위: FastAPI 백엔드, Supabase Auth/Data API/RPC, 외부 AI 통신.
프론트엔드 및 Bluetooth 페어링 구현은 이 문서의 변경 범위가 아니다.

## 적용된 대책

| 위협 | 적용 대책 | 검증 방법 |
|---|---|---|
| SQL Injection 및 잘못된 입력 | Pydantic 길이·범위·열거형 검증, 추가 필드 거부, 고정된 Supabase REST/RPC 경로와 파라미터 사용 | 공격 문자열이 실행 경로가 아닌 데이터로 처리되는 회귀 테스트 |
| 인증·수평 권한 상승 | Supabase 액세스 토큰을 Auth API로 검증하고, 클라이언트가 전달한 ID가 아닌 인증 사용자 ID로 조회·변경 | 미인증 및 타 사용자 접근 실연동 테스트 |
| 서비스 키 노출 | 서비스 키는 서버 환경변수로만 주입하고 `backend/.env`는 Git에서 제외 | 저장소 검색 및 CI 비밀 탐지 도구로 지속 확인 필요 |
| 통신 구간 | 배포 API, Supabase 및 선택적 AI 서버에 HTTPS 사용, 서버 HTTP 클라이언트의 운영체제 프록시 자동 신뢰 차단 | 배포 주소·인증서와 `trust_env=False` 회귀 테스트 확인 |
| 브라우저 기반 공격 | HSTS, nosniff, frame 차단, referrer·permissions policy, API 응답 캐시 금지 | `backend/tests/test_security.py` |
| Host Header 공격 | `BACKEND_ALLOWED_HOSTS` 허용 목록 외 Host 거부 | 허용되지 않은 Host가 400인지 테스트 |
| 과도한 요청 본문 | 기본 1 MiB 요청 본문 상한 | 제한 초과 요청이 인증·본문 파싱 전에 413인지 테스트 |
| 오류를 통한 개인정보 노출 | 검증 오류에서 실제 입력값을 제거하고 필드 위치만 반환 | 비밀 표식 문자열이 응답에 포함되지 않는지 테스트 |
| 운영 공격 표면 | 공유 개발 서버의 API 문서는 팀 연동을 위해 공개하고 테스트용 roundtrip API는 비활성화 | Render 환경변수와 배포 후 문서 200·테스트 경로 404 확인 |
| 공급망 취약점 | CI에서 `pip-audit`, Bandit 및 전체 백엔드 테스트 실행 | GitHub Actions `Backend security` 결과 |

## Supabase 권한 모델

`public` 테이블은 RLS를 활성화하고 `anon` 및 `authenticated`의 직접 데이터 접근을
철회한다. FastAPI만 서버 비밀키로 Data API/RPC를 호출하며, 서버는 모든 데이터 요청에
인증 사용자 ID를 강제로 사용한다. RLS 정책이 없는 서버 전용 테이블은 직접 클라이언트
접근을 거부하는 의도된 deny-by-default 구조지만, 테이블과 RPC가 추가될 때마다 GRANT,
RLS, 함수 실행 권한을 다시 점검해야 한다. 업무용 RPC는 `SECURITY INVOKER`와
service-role 전용 실행 권한을 사용한다. 기존 `handle_new_user` 인증 트리거는 제한된
초기 프로필 생성에만 `SECURITY DEFINER`를 사용하고 빈 `search_path`를 강제하며,
후속 마이그레이션에서 `PUBLIC`·`anon`·`authenticated`의 직접 실행 권한을 철회한다.

2026-09-14 원격 Auth 설정에서 유출 비밀번호 보호를 활성화했다. 변경 후 Security
Advisor 재점검 결과 ERROR 0건, WARN 0건, INFO 14건이다. INFO 14건은 RLS가 켜져 있지만
정책이 없는 서버 전용 테이블이다. `anon`·`authenticated` 권한 철회와 service-role 전용
접근이 유지되는지 배포 때마다 함께 검증한다.

같은 날 `pip-audit` 2.10.1로 고정된 운영 의존성을 검사해 알려진 취약점 0건을 확인했고,
Bandit 1.9.4로 `backend/app`을 검사해 보안 경고 0건을 확인했다.

## 로그 및 개인정보 정책

- Authorization, Supabase 키, AI 공유키, 이메일, 전체 사용자 ID, 건강정보, 채팅 본문과 응답 본문을 기록하지 않는다.
- 보안 감사 로그가 필요하면 사건 유형, 시간, HTTP 상태, 라우트 템플릿, 요청 상관관계 ID만 기록한다.
- 플랫폼 접근 로그의 IP 보관기간과 접근 권한을 최소화하고 정기적으로 검토한다.
- 장애 응답에는 내부 DB 오류, SQL, 외부 서비스 응답 본문 또는 stack trace를 포함하지 않는다.

## Bluetooth 및 외부 데이터 경계

현재 백엔드는 Bluetooth 장치와 직접 통신하지 않는다. 향후 앱이 웨어러블 데이터를
전송하면 백엔드는 인증된 HTTPS 요청만 허용하고, 스키마·크기·시간 범위를 검증하며,
장치 식별자를 가명화하고 필요한 데이터만 제한된 기간 동안 저장한다. BLE 페어링,
운영체제 권한 및 장치 간 암호화 검증은 앱 영역이며, 서버는 수신 이후의 저장·접근·삭제와
외부 전송을 책임진다.

## 배포 전 수동 확인

- Supabase Auth의 유출 비밀번호 보호가 활성 상태인지 확인한다.
- Security Advisor의 ERROR/WARN을 확인하고, RLS 정책 없음 INFO는 서버 전용 권한 철회가 유지되는지 검증한다.
- 공유 개발 Render에서 `/docs`, `/redoc`, `/openapi.json`이 200인지 확인하고,
  `/api/test/roundtrip`은 404인지 확인한다. 문서 공개 여부와 무관하게 보호 API의 JWT
  인증·소유권 검사는 유지한다.
- 실제 API 응답에 보안 헤더가 존재하고 HTTP가 HTTPS로 리다이렉트되는지 확인한다.
- 서비스 키와 AI 공유키의 담당자, 교체 주기, 폐기 및 사고 대응 절차를 지정한다.

참고: [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security),
[비밀번호 보안](https://supabase.com/docs/guides/auth/password-security),
[운영 배포 점검](https://supabase.com/docs/guides/deployment/going-into-prod).
