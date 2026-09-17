# 식단 촬영 이미지 실연동 검증

기준일: 2026-09-17

- 대상 Supabase: `eeeqibyssajykrhvecbv` (공유 개발 DB)
- `add_meal_log_photos` 마이그레이션 적용 완료.
- `meal-photos`: 비공개, 최대 5 MiB, JPEG/PNG/WebP.
- 기존 `meal_logs.photo_storage_path`를 사용하며 별도 메타데이터 테이블은 만들지 않음.
- 로컬 FastAPI + 실제 원격 Supabase로 검증 13개 통과.
- 합성 사용자 2명과 테스트 식사 기록·Storage 객체 정리 완료.

검증 내용: 실제 인증, 소유권 확인, 사진 업로드, 중복 업로드 차단,
새 HTTP 클라이언트의 식단 기록 재조회, 저장 경로 복원, 서명 URL로 원본 바이트 다운로드,
다른 사용자의 기록 비노출, 비공개 버킷의 공개 URL 접근 차단.

```sh
backend/.venv/bin/python -m backend.tests.meal_photo_live_integration --local
```

배포 후 검증:

```sh
backend/.venv/bin/python -m backend.tests.meal_photo_live_integration
```

현재 상태: Render 로그인 대기. 배포 서버 대상 검증은 아직 실행하지 않음.
