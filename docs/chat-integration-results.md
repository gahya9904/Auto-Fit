# 챗봇 저장 API 통합 검증 기록

날짜: 2026-09-08. 대상: Auto-Fit (`eeeqibyssajykrhvecbv`).

## 적용 및 결과

- 원격 마이그레이션: `20260908012312_chat_message_storage`.
- 기존 채팅 0건·메시지 0건 확인 후 적용했다. 외래키 0개 유지.
- RLS 활성화 유지, 저장 RPC는 service_role만 실행 가능.
- 임시 계정 2개를 생성하고 실제 Supabase 비밀번호 로그인을 거쳤다.
- 로컬 FastAPI ASGI 앱에 실제 액세스 토큰을 보내 원격 Auth 검증 및 Data API 호출을 수행했다.
- 전체 실연동 검증 24개 통과. 인증 의존성은 모의 처리하지 않았다.
- 점수 91 → 86의 DB 직접 답변과 근거를 확인했다.
- 동일 요청 6개 동시 전송: 201 한 건·200 다섯 건, 같은 메시지 ID.
- 동일 ID·다른 내용 동시 전송: 201 한 건·409 한 건.
- 타 사용자 조회·수정·전송: 404. 직접 클라이언트 RPC 호출: 거부.
- 커서 조회, 메시지 순서, 보관 후 재전송 허용·새 메시지 거부 확인.
- 생성한 계정·프로필·점수·메시지·채팅만 삭제했다. 테스트 후 채팅·메시지·테스트 계정 모두 0건.

## 보안 점검

적용 전후 security advisor에서 새 항목은 발생하지 않았다.
기존 [유출 비밀번호 보호 미활성화](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
경고 1개와 [RLS 정책 없음](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
정보 13개가 남아 있다. 이번 채팅 변경으로 발생한 항목은 아니며 설정을 변경하지 않았다.

## 검증 범위와 남은 작업

실제 DB·인증을 사용했지만 배포된 HTTP 서버, 프론트 UI, Google/Kakao OAuth 화면은 이번에 테스트하지 않았다.
부하 테스트·AI 호출·1개월 자동 삭제·429 요청 제한도 완료 항목에 포함되지 않는다.
로컬의 과거 마이그레이션 일부는 원격 타임스탬프와 달라 전체 db push 전 별도 정리가 필요하다.
이번 마이그레이션 파일은 원격 버전과 일치하도록 이름을 맞췄다.

## 재실행

`backend/.env`가 지정한 프로젝트와 일치해야 한다. 테스트는 실제 계정과 합성 데이터를 생성한다.
실행은 승인된 테스트 환경/프로젝트에서만 한다.

```sh
backend/.venv/bin/python -m backend.tests.chat_live_integration --project eeeqibyssajykrhvecbv
```

스크립트는 종료 시 자신이 생성한 리소스를 정리한다. 프로세스를 강제 종료하면 정리가 생략될 수 있다.
키·토큰·비밀번호는 출력하지 않는다.
