# 챗봇 요청 제한 배포 결과

검증일: 2026-09-08. 공유 개발 서버 검증이며 전체 제품 운영 준비 완료를 뜻하지 않는다.

| 항목 | 결과 |
|---|---|
| 서버 | https://auto-fit-api-dev.onrender.com |
| 배포 코드 | `7e8171fd0c1540bf3099d68d7cc9d7b5e7bc338d` |
| Render 배포 | `dep-dafo5n0u01pc73b8jsj0`, Live |
| DB migration | `20260908033403_chat_rate_limits` |
| Python 회귀 검사 | 170개 통과 |
| 격리 SQL 검사 | 요청 제한 18개, 보관 정책 12개 통과 |
| 공용 HTTPS 통합 검사 | 45개 통과 |
| 의존성 검사 | pip-audit, 알려진 취약점 없음 |
| 접속 확인 | /health, /docs HTTP 200 |

## 공용 서버에서 확인한 사항

- 기존 저장·조회·소유권·중복 전송·페이지네이션 검사 24개 통과.
- 새 답변 10회 허용, 11회째 429와 `detail.retry_after` 및 `Retry-After` 일치.
- 답변 한도 소진 뒤에도 기존 메시지 재전송 및 기록 조회 허용.
- 다른 사용자의 한도 독립, 실제 시간 경과 후 재허용.
- 동시 답변 요청 20건 중 정확히 10건 허용, 10건 차단.
- 테스트 사용자 요청 이벤트 59건을 넣은 경계 검사: 다음 조회 허용, 그 다음 조회 429.
- 인증된 클라이언트의 제한 RPC 직접 호출 거부.
- 합성 계정 2개 및 해당 계정의 채팅·점수·프로필·요청 이벤트 삭제 후 잔존 여부 확인.

실행 명령:

```sh
backend/.venv/bin/python -m backend.tests.chat_live_integration --project eeeqibyssajykrhvecbv --api-base https://auto-fit-api-dev.onrender.com --rate-limits
```

이 명령은 합성 계정과 데이터를 생성·삭제하므로 공유 DB에서 실행하기 전에 승인 범위를 확인한다.
기존 사용자 데이터는 테스트 대상으로 사용하지 않는다. 인증 정보 및 응답 본문은 출력하지 않는다.

## DB 운영·보안

RLS 활성, anon/authenticated의 테이블 조회 및 RPC 실행 불가, service_role 실행 가능, 외래키 0개를 확인했다.
5분 주기 요청 이벤트 정리와 기존 30일 메시지 정리 모두 2026-09-08 12:35 KST 실행 성공을 확인했다.

Supabase Advisor: ERROR 0, INFO 14, WARN 1. 새 테이블의 [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 서버 전용 접근 설계에 해당한다.
기존 [유출 비밀번호 보호 비활성 경고](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)는 남아 있으며 이번 배포에서 인증 설정은 변경하지 않았다.

## 남은 범위

팀원 AI 모델 연결, 프론트 화면의 429 대기 표시, 전체 UI 통합 검증은 별도다.
이번 제한은 인증된 챗봇 API용이며 로그인·미인증 트래픽·IP 기반 방어를 대신하지 않는다.
정책과 프론트 처리 방법은 [요청 제한 안내](chat-rate-limits.md)를 따른다.
