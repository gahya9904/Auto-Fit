# 식단 API 지연 측정

`GET /api/diet/recommendations`, `/latest`, `/api/diet/meal-logs`,
`/api/diet/nutrition-summary`에 한해 `[diet-timing]` JSON 로그를 남긴다.
기존 응답 본문, 인증, 쿼리 순서, HTTP 연결 수명은 변경하지 않는다.

- `trace_id`: 서버 생성 무작위 ID. 응답 `X-Diet-Trace-Id`와 대응한다.
- `route`, `status`, `total_ms`: 경로, 응답 상태, 앱 진입부터 응답 전송까지의 시간.
- `stages`: `auth`, `recommendation`, `meals`, `foods`, `menu_images`,
  `meal_logs`, `meal_log_items`, `meal_photos`별 `calls`와 누적 `ms`.

단계 시간에는 HTTP 클라이언트 생성·종료, 연결, 외부 응답 본문 수신이 포함된다.
DB 실행 시간만을 뜻하지 않으며, 응답 수신 이후 JSON 파싱은 포함하지 않는다.
`meal_photos`는 해당 요청의 사진 URL 서명 처리 전체를 측정한다.
조회 결과가 비어 생략된 단계는 로그에 나타나지 않는다.
전체 시간에는 인증·검증·직렬화가 포함되지만 Render 대기, 브라우저 네트워크,
프론트 렌더링은 포함되지 않는다. 병렬 구간이 생기면 단계 시간을 더해
전체 시간과 비교하는 방식은 사용할 수 없다.

## 수집 및 종료

1. Render의 Application logs에서 `[diet-timing]`으로 검색한다.
2. 같은 날짜를 여러 번 조회해 첫 요청과 반복 요청을 비교한다.
3. 정상/느린 요청의 `total_ms`, 단계 시간을 비교한다.
4. 측정 종료 시 `DIET_TIMING_ENABLED=false`로 비활성화한다 (기본값 true).
   진단 완료 후 계측 코드 제거 여부를 판단한다.

로그에는 토큰, 사용자 ID, 이메일, IP, 쿼리 문자열, 식단 내용, 사진 경로,
외부 응답 본문 또는 예외 메시지를 넣지 않는다. 날짜도 기록하지 않는다.
Request ID를 클라이언트에서 받지 않으므로 로그 삽입 공격을 피한다.
프론트 JS에서 응답 헤더를 읽기 위한 CORS 설정은 변경하지 않았다.
