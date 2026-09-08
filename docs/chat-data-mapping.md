# 챗봇 DB 우선 답변: 질문 분류와 조회 설계

기준일: 2026-09-08. 채팅 테이블 구조·권한을 실제 Auto-Fit DB와 대조하고 저장 마이그레이션을 적용했다.

## 구현 상태

`backend/app/chat_intents.py`에 규칙 기반 질문 분류와 조회 대상 허용 목록을 구현했다.
자연어 분류기와 건강 점수 실제 조회·충분성 판단·답변을 읽기 전용 preview API에 연결했다.
자연어 날짜 해석과 AI 연동은 후속 구현이다. 메시지 저장 API 구현·DB 적용·실제 인증과 동시 요청 검증은 완료했다.
분류 결과만으로 AI를 자동 호출하면 안 된다.

### 자연어 답변 미리보기

`POST /api/chats/answer-preview`에 기존 Supabase Bearer 토큰과
`{"content":"건강 점수가 이전보다 얼마나 변했어?"}`를 전달한다.
content는 앞뒤 공백 제거 후 1~500자이며 추가 필드(예: user_id)는 거부한다.
응답의 answer.content를 표시하고 evidence, response_source, required_data를 처리한다.
현재는 한국어 규칙 기반 분류로 건강 점수 최신값·바로 이전 평가 비교와 식사·운동 기록 요약을 지원한다.
지원하지 않는 주제·여러 주제·정의·기간·통계 질문은 clarification 안내를 반환한다.
기간 검출은 제한된 표현 목록이므로 모든 자연어 표현을 이해하는 기능은 아니다.
원인 질문은 점수만으로 원인을 단정하지 않고 평가 항목별 근거가 더 필요함을 알린다.
이 API는 질문이나 답변을 저장하지 않으며 AI 호출도 하지 않는다.
정식 `/api/chats/{chat_id}/messages`의 저장·멱등성 구현은 아래 저장 API 상태를 참고한다.

### 저장 API 상태

채팅방 생성·목록·수정, 메시지 조회·전송의 5개 API를 구현했다.
적용 SQL: `supabase/migrations/20260908012312_chat_message_storage.sql`.
기존 테이블에 출처·근거·요청 ID를 추가하고 사용자별 요청 ID와 sender_type의 유일 인덱스를 둔다.
save_chat_exchange는 service_role만 실행 가능하며 외래키를 추가하지 않는다.
원격 DB에 적용했고 실제 Supabase 로그인으로 생성 → 전송 → 동일 요청 재전송
→ 조회 → 보관 → 신규 전송 거부 흐름을 검증했다.
동일 요청 6개를 동시에 보내 201 한 건·200 다섯 건과 동일 메시지 ID를 확인했다.
같은 ID에 다른 내용을 동시에 전송하면 201 한 건·409 한 건이며 한 쌍만 저장된다.
검증 결과와 한계는 [통합 테스트 기록](chat-integration-results.md)을 참고한다.

SQL 격리 테스트는 `backend/tests/chat_storage_sql.mjs`로 실행한다.
Node.js에 테스트용 `@electric-sql/pglite@0.3.14`를 별도 설치한 뒤 패키지의 절대 경로를 인자로 전달한다.
이 테스트는 원격 DB와 연결하지 않으며 다중 연결 동시성 검증을 대체하지 않는다.

되돌리기: 배포한 API 버전을 먼저 이전 버전으로 되돌리고 새 DB 함수의 service_role 실행 권한을
회수한다. 추가 컬럼·인덱스는 데이터를 보존하기 위해 유지한다. 재활성화 시 실행 권한을 복구한다.
2026-09-08 기준 메시지 생성 후 30일 자동 삭제 작업을 5분 주기로 활성화했다.

### 건강 점수 미리보기 (2026-09-08 구현)

`POST /api/chats/health-score-preview`에 기존 Supabase Bearer 토큰을 전달한다.
요청 예: `{"mode":"change","explain":false}`. mode는 latest(기본값) 또는 change이며,
최근 평가와 바로 이전 평가를 대상으로 한다. 특정 주·월을 비교하는 기능은 아직 없다.
explain=true이면 원인 설명 근거 부족을 안내한다. AI 호출은 하지 않는다.

응답은 `{"answer":{"content":"…","intent":"health_score_change","response_source":"database",
"needs_more_data":false,"evidence":[],"required_data":[]}}` 형식이다.
이는 메시지를 저장하지 않는 미리보기 응답이며 정식 전송 API의 assistant_message와 구분한다.
user_id 입력은 거부하며 기존 인증 의존성으로 결정한 사용자만 조회한다.
Supabase 조회 실패·잘못된 반환 데이터는 502 DATA_SOURCE_ERROR이고 데이터 없음과 구분한다.
인증·입력 오류는 기존 서버의 401·422 형식을 사용한다. 정식 챗봇 오류 규격 통합은 후속 작업이다.

모의 HTTP 테스트로 사용자 필터·최소 컬럼·정렬·입력 검증 및 데이터 부족 분기를 검증했다.
실제 Supabase의 임시 테스트 계정과 점수 데이터로 통합 테스트를 완료했다. 프론트 화면 테스트는 아직이다.

## 데이터 매핑

### 식사·운동 기록 요약 구현 (2026-09-08)

- 자연어 미리보기와 정식 메시지 전송 모두 연결했다. 프론트 요청 형식 변경은 없다.
- 예: '오늘 먹은 음식 알려줘', '이번 주 운동 몇 번 했어?', '최근 7일 식사 기록 알려줘'.
- 기간: 오늘·어제·이번 주·지난주·최근 7일. 한국 시간(Asia/Seoul), 월요일 주 시작.
- 현재 기간은 요청 시각까지이며 특정 끼니·평균·기간 비교·영양소별 질문은 아직 미지원이다.
- 식사: recorded 기록만 집계. 음식 목록과 기록된 열량 합계 반환. 음식 또는 열량 누락 시 합계를 추정하지 않는다.
- 운동: 완료 동작이 1개 이상인 completed/stopped 세션의 횟수·시간·예상 소모 열량을 반환한다.
- 부모 식사 ID는 본인 user_id로 조회하고 음식 항목은 확인한 부모 ID에 한정한다.
- 최대 100개씩 조회하며 초과하면 부분 합계를 답하지 않고 더 짧은 기간을 요청한다.
- 이번 신규 기능은 모의 HTTP 테스트로 날짜 경계·소유권 필터·누락·합계를 검증했다.
  식사·운동의 신규 실제 DB 통합 테스트는 아직 수행하지 않았다. 기존 24개 실연동 검증은 건강 점수·채팅 저장 기준이다.

| 질문 유형 | 테이블 | 조회·답변 기준 |
| --- | --- | --- |
| health_score_latest | health_assessments, health_assessment_items | 본인 user_id, assessed_at 최신순. overall_score와 평가 날짜 표시 |
| health_score_change | health_assessments, health_assessment_items | 비교할 평가 2건 필요. 점수 차이는 서버 계산. 원인은 단순 차이로 단정하지 않음 |
| body_composition | body_compositions | 본인 user_id, measured_at 기준. 질문한 측정값과 단위만 반환 |
| health_checkup | health_checkups | 본인 user_id, checkup_date 기준. 질문한 검사 수치만 반환 |
| meal_history | meal_logs, meal_log_items | 본인 식사 기록에서 요청 기간과 실제 섭취 내역 조회 |
| exercise_history | exercise_sessions, exercise_logs | 본인 세션에서 요청 기간·상태 확인. 건너뛴 운동을 수행 횟수에 포함하지 않음 |
| allergies | user_allergies, allergy_types | 본인 선택 내역과 직접 입력값 조회. 빈 목록은 알레르기 없음의 증거가 아님 |
| food_inventory | user_food_inventory, food_items | 본인 재료의 is_available 및 expires_on 확인. 이름은 custom_name 또는 연결된 food_items |
| clarification | 없음 | 미지원·모호·여러 주제 질문은 추가 질문. 무조건 일반 AI로 넘기지 않음 |

분류기는 조회 후보를 정한다. '왜', '추천', '뜻' 등의 질문은 requires_explanation으로
표시하며 DB 조회 수치만으로 답변을 완료하지 않는다. 여러 주제가 섞이거나 이전 대화가
필요한 질문은 현재 MVP 분류기에서 clarification으로 처리한다.

## 조회 경계

- 검증된 JWT의 사용자 ID로 최상위 레코드를 제한한다.
- health_assessment_items처럼 user_id가 없는 테이블은 본인 소유가 확인된 부모 ID로만 조회한다.
- 연결된 자식에 user_id가 있으면 부모 ID와 user_id를 모두 검사한다. 외래키는 추가하지 않는다.
- 질문이나 AI 출력으로 SQL 또는 테이블 이름을 생성하지 않는다.
- 기간을 해석할 수 없으면 재질문한다. 과거 측정값은 현재 상태로 표현하지 않는다.
- 원본 raw_data, raw_result, input_snapshot 전체를 AI에 보내지 않는다.
- 충분한 사실은 database, 누락된 개인 데이터는 need_more_data로 처리한다.
- AI 연결 시에도 개인 데이터 누락을 추측으로 채우지 않는다.

## 대화 보관기간

팀 확정 사항은 각 메시지 생성 후 30일(720시간) 보관이다.
5분 주기로 만료된 질문·답변·근거 행을 삭제한다. 채팅방과 건강 원본 데이터는 유지한다.
제목 정리와 지연·재전송의 세부 기준은 [보관 정책](chat-retention-policy.md)을 따른다.
DB 삭제 외에 로그·캐시·백업 및 AI 제공자에 남는 사본의 보관도 별도로 확인한다.

## 다음 구현 순서

1. 건강 점수 조회부터 사용자 소유권·기간·누락 검증 및 DB 직접 답변을 연결한다.
2. 채팅 API 5개와 원자적 메시지 저장·멱등성·페이지네이션을 구현한다.
3. 나머지 데이터 유형 및 AI 보완 응답을 연결한다.
4. 확정된 만료 기준으로 조회 제외와 자동 정리를 구현한다.
5. 실제 Supabase 및 프론트엔드 통합 테스트를 수행한다.

프론트 계약 정정: 답변은 `assistant_message.content`이며 `answer.content`가 아니다.
채팅방 상태는 `active` / `archived`이고 팝업 닫기는 보관 처리와 별개다.
