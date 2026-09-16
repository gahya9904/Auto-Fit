# 식단 피드백 상태 수정

- 최초 등록: 기존 POST /api/diet/meals/{diet_meal_id}/feedback 유지 (중복 409).
- 수정: PATCH /api/diet/meals/{diet_meal_id}/feedback. Bearer 인증 필수.
- 필수 feedback_type: eaten, different_food, skipped 중 하나.
- eaten_at: 생략 또는 null이면 기존 섭취 시각 유지.
- actual_items: different_food에서는 실제 음식 목록 필수. 다른 상태에서는 생략 또는 빈 배열.
- 음식 목록은 수정 요청의 목록 전체로 교체된다.
- 응답: 기존 POST와 동일한 {ok: true, result: {feedback, meal_log}}.
- skipped 응답의 meal_log는 null. 기존 섭취 기록은 deleted 상태로 전환되고 항목은 제거된다.
- 피드백 미등록 또는 다른 사용자의 식단: 404. 유효하지 않은 입력: 422. DB 연동 오류: 502.
- 동일 상태 재요청 가능. feedback ID 유지. 모든 변경은 한 DB 트랜잭션에서 수행된다.

```json
{"feedback_type": "skipped"}
```

배포 시 20260916071945_update_diet_meal_feedback.sql 마이그레이션을 먼저 적용하고 백엔드를 배포한다.
