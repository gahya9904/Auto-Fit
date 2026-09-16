# 식단 API 배포 실연동 검증 결과

기준일: 2026-09-16

## 검증 대상

| 항목 | 값 |
|---|---|
| 공유 API | `https://auto-fit-api-dev.onrender.com` |
| Render 배포 | `dep-dal1u05bedkc73autnng` (Live) |
| 배포 커밋 | `007ea3d` |
| Supabase 프로젝트 | `eeeqibyssajykrhvecbv` |
| 자동화 도구 | `backend/tests/diet_live_integration.py` |

## 결과

인증된 합성 사용자 2명으로 25개 검사를 실행했고 모두 통과했다.

- 냉장고 재료 생성·조회·수정·멱등 삭제
- 다른 사용자의 재료 수정 차단 및 삭제 요청의 존재 정보 비노출
- 오늘 식단 생성과 KST 날짜별 추천 조회
- 선택한 한 끼 재추천 후 기존 ID·타입·순서 유지와 대표 음식 변경
- 다른 사용자의 한 끼 재추천 차단
- 인증 클라이언트의 `replace_diet_meal` RPC 직접 실행 차단
- 추천 식사 섭취 기록과 날짜별 영양 섭취량 반영
- KST 날짜 범위의 식사 기록 조회
- 테스트 종료 후 합성 사용자 2명, 세션, 냉장고·추천·끼니·음식·섭취 기록 정리

## 재실행

`backend/.env`가 연결된 개발 Supabase 값을 가리킬 때만 실행한다.

```bash
backend/.venv/bin/python -m backend.tests.diet_live_integration \
  --project eeeqibyssajykrhvecbv \
  --api-base https://auto-fit-api-dev.onrender.com
```

스크립트는 허용된 API 주소와 Supabase 프로젝트가 일치하는지 먼저 확인한다. 실행 중
합성 Auth 사용자와 데이터를 만들지만 `finally` 정리 단계에서 세션을 로그아웃하고 생성한
레코드와 사용자를 제거한다. 자격 증명, 토큰, 응답 본문은 출력하지 않는다.

## 해석 범위

이번 결과는 배포된 백엔드 API와 원격 Supabase의 데이터 왕복 및 소유권 검증을 보장한다.
프론트 화면의 로딩·빈 상태·오류 문구·사용자 조작까지 검증한 결과는 아니다.
