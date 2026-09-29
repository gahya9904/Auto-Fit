# 모바일 AI 식단 생성 테스트

공용 개발 서버의 `/test/diet-generation`에 모바일 브라우저로 접속한다.

1. 프론트엔드 담당자 계정으로 로그인한다.
2. `4끼 전부 AI 즉시 생성`을 누른다.
3. 완료 시간, `AI 식단 4/4`, 아침·점심·저녁·간식 결과를 확인한다.

테스트 화면은 인증된 사용자만 아래 API를 호출한다.

```http
POST /api/diet/recommendations/generate-preview
Authorization: Bearer <access-token>
Content-Type: application/json

{}
```

이 API는 사용자 냉장고 재료와 알레르기만 읽고 DB 음식 카탈로그는 조회하지 않는다.
생성 결과는 응답으로만 반환하며 운영 식단에는 저장하지 않는다. 기존
`POST /api/diet/recommendations/generate`와 자정 정기 갱신의 혼합 생성 방식은 변경하지
않는다.
