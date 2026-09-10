# Auto-Fit 프론트엔드 협업용 전체 API 안내

기준일: 2026-09-10. 근거: `backend/app/main.py`, 챗봇 모듈, 저장소 SQL, 기존 검증 기록.
현재 FastAPI operation은 **40개**다. 아래 목록은 구현된 코드 기준이며 서버 배포 완료 목록은 아니다.

## 공유 파일

- 이 문서: 화면별 API, 호출 순서, 응답 주요 경로, 예제, 미구현 영역.
- [입력 필드 전체 참조](api-input-reference.md): 40개 operation의 파라미터·본문 필드·제약.
- [OpenAPI 원본](openapi.json): 코드에서 추출한 3.1 스키마. API 도구에 가져오기 가능.
- [챗봇 상세 계약](chat-api-contract.md): 메시지·근거 전체 형식과 재전송 규칙.
- [실연동 검증 기록](chat-integration-results.md): 실제 검증 범위와 한계.

OpenAPI는 요청 스키마에 유용하지만 대부분 응답은 아직 `dict[str, Any]`로 선언되어 있다.
따라서 자동 생성된 응답 타입만으로 프론트 타입이 완성되지는 않는다. 아래 주요 응답 경로와
실제 개발 서버 응답을 함께 확인해야 한다. 이 문서는 현재 로컬 서버 구현을 기준으로 한다.

## 1. 접속·인증 공통 규칙

| 항목 | 현재 규격 |
|---|---|
| 개발 API 주소 | `http://localhost:8000` — 서버 실행 시 사용. 팀원 PC의 localhost는 팀원 PC를 가리킴 |
| 공유·배포 주소 | 미확정. 백엔드 담당이 실제 접근 가능한 주소를 별도 전달해야 함 |
| 실행 시 문서 | `{API_BASE}/docs`, `{API_BASE}/openapi.json` |
| 로그인 | 프론트가 Supabase Auth 사용. FastAPI `/login` API는 없음 |
| 인증 헤더 | `Authorization: Bearer <Supabase access_token>` |
| 인증 예외 | `/health`만 인증 불필요. OpenAPI의 optional 헤더 표기와 무관하게 나머지는 인증 필수 |
| 본문 | `Content-Type: application/json`, 필드명 `snake_case` |
| 사용자 ID | 요청에 넣지 않음. 서버가 검증된 로그인 사용자로 결정 |
| 서버 전용 키 | service_role/secret은 프론트에 공유하지 않음 |
| CORS | `FRONTEND_ORIGIN`(기본 `http://localhost:3000`)과 Expo Web `http://localhost:8081` 허용. 다른 포트·도메인은 별도 협의 |
| ID | 응답에서 받은 UUID를 재사용. session_id와 exercise_item_id 등 서로 다른 ID를 혼용하지 않음 |
| 날짜 | `YYYY-MM-DD`; 시각은 timezone 포함 ISO 8601로 전송 |
| 수치 | 응답은 직접 DB JSON 또는 Decimal 직렬화에 따라 숫자/문자열 가능. 표시 계층에서 안전하게 변환 |

GET은 JSON 본문 없이 호출한다. 아래 표의 `{}`는 빈 객체 본문을 보내야 하는 POST다.
POST라고 모두 201은 아니다. 코드가 지정한 성공 코드를 표에 명시했다.

## 2. 인증·프로필·온보딩 (7개)

| Method | 경로 | 입력 | 성공 응답 주요 경로 | 성공 코드 |
|---|---|---|---|---|
| GET | `/health` | 없음 | `status` | 200 |
| POST | `/api/test/roundtrip` | `message` 1~200자 | `ok, message, received_at, user_id, profile` | 200 |
| GET | `/api/profile` | 없음 | `profile, exercise_preferences` | 200 |
| PATCH | `/api/profile` | ProfileUpdateRequest | `ok, profile` | 200 |
| GET | `/api/allergies` | 없음 | `catalog[], selected[]` | 200 |
| PUT | `/api/allergies` | `allergy_type_ids[], custom_names[]` | `ok, selected[]` | 200 |
| POST | `/api/onboarding/complete` | `{}` | `ok, already_completed, profile` | 200 |

- 프로필 수정: name, nickname, birth_date, gender, target_weight, activity_level 중 하나 이상.
- gender: male/female/other. activity_level: sedentary/light/moderate/active/very_active.
- 생년월일 미래 날짜 거부. 이름 1~50자, 닉네임 최대 30자, 목표 체중 20~500.
- 알레르기 PUT은 전체 선택 교체다. 체크된 전체 ID를 보내고 선택 해제는 빈 배열로 보낸다.
- 카탈로그 선택 최대 12개, 기타 이름 최대 5개(각 1~50자), 중복 정리.
- 온보딩은 name/birth_date/gender가 필요하며 누락 시 409와 fields 반환. 이미 완료됐으면 already_completed=true.
- 로그인 후 `GET /api/profile`로 현재 사용자의 가입 완료 여부와 기본 정보를 조회한다.
- 프로필 응답 주요 필드: user_id, name, nickname, birth_date, gender, target_weight, activity_level, onboarding_completed_at, updated_at. 같은 응답의 exercise_preferences는 연결된 운동 목표·경험 수준이며 미설정 시 null이다.

## 3. 운동 설정·추천 (6개)

| Method | 경로 | 입력 | 성공 응답 주요 경로 | 코드 |
|---|---|---|---|---|
| GET | `/api/exercise/preferences` | 없음 | `preferences` (없으면 null) | 200 |
| PUT | `/api/exercise/preferences` | `goal_type, experience_level` | `ok, preferences` | 200 |
| GET | `/api/exercise/recommendation-contexts/latest` | 없음 | `context` (없으면 null) | 200 |
| POST | `/api/exercise/recommendation-contexts` | ExerciseRecommendationContextRequest | `ok, context` | 200 |
| GET | `/api/exercise/recommendations/latest` | 없음 | `result` (없으면 null) | 200 |
| POST | `/api/exercise/recommendations/generate` | `{}` | `ok, generator, result` | 200 |

추천 전 preferences와 새 context를 저장한다. 누락되면 409다.
goal_type: weight_loss/muscle_gain/endurance/maintenance/rehabilitation.
experience_level: beginner/intermediate/advanced.

```json
{
  "available_minutes": 60,
  "location": "gym",
  "available_equipment": ["machine", "dumbbell"],
  "condition_level": "보통",
  "discomfort_areas": [],
  "condition_note": null
}
```

시간 5~300분. 장소 gym/home/outdoor/other. 장비 machine/band/dumbbell/mat/other.
condition_level 1~30자, 불편 부위 최대 10개(각 1~50자), 메모 최대 500자.

`result.recommendation`은 exercise_recommendation_id, recommendation_date, goal,
total_duration_minutes, intensity, recommendation_summary, ai_reason, status 등을 가진다.
`result.items[]`는 exercise_item_id, exercise_name, sequence_order, sets, repetitions,
execution_type, target_duration_seconds, target_weight_kg, rest_seconds, instruction 등을 가진다.
운동 상세·수행 화면에는 여기서 받은 exercise_item_id를 사용한다.
현재 추천 생성기는 **rules_v1**이며 기본 프로필의 activity_level도 강도 결정에 반영한다. ai_reason이라는 필드명이 AI 모델 호출을 의미하지 않는다.

## 4. 운동 수행·피드백 (9개)

| Method | 경로 | 입력 | 성공 응답 주요 경로 | 코드 |
|---|---|---|---|---|
| POST | `/api/exercise/sessions/start` | `{}` | `ok, result.session, result.items[]` | 200 |
| POST | `/api/exercise/sessions/{session_id}/items/{item_id}` | ExerciseItemResultRequest | `ok, result.session, result.log` | 200 |
| POST | `/api/exercise/sessions/{session_id}/complete` | `{}` | `ok, result.session, result.logs[]` | 200 |
| GET | `/api/exercise/sessions/latest` | 없음 | `result.session, result.logs[]` 또는 result=null | 200 |
| POST | `/api/exercise/sessions/{session_id}/discomfort` | ExerciseDiscomfortRequest | `ok, result.discomfort, result.session, result.adjusted_items[]` | 200 |
| GET | `/api/exercise/sessions/{session_id}/discomfort` | 없음 | `logs[]` | 200 |
| PUT | `/api/exercise/sessions/{session_id}/feedback` | ExerciseSessionFeedbackRequest | `ok, feedback` | 200 |
| GET | `/api/exercise/sessions/{session_id}/feedback` | 없음 | `feedback` (없으면 null) | 200 |
| GET | `/api/exercise/sessions/{session_id}/analysis` | 없음 | `analysis, result` | 200 |

시작은 최신 active 추천이 필요하다. session_id는 result.session.exercise_session_id이다.
session의 주요 집계: status, started_at, completed_at, planned_item_count, completed_item_count,
skipped_item_count, total_duration_seconds, total_calories_burned, completion_rate.
상태는 in_progress/completed/stopped/skipped이며 화면 상태와 매핑한다.

운동 한 항목 완료 예:

```json
{
  "completed": true,
  "skipped": false,
  "duration_minutes": 5,
  "completed_sets": 3,
  "performed_repetitions": 12,
  "performed_weight_kg": 20,
  "note": null,
  "skip_reason": null
}
```

completed/skipped 중 정확히 하나만 true여야 한다. 건너뛰기는 skip_reason 필수.
이 API는 **운동 항목 단위 결과**이며 매 세트마다 별도 완료 이벤트를 저장하는 API는 아니다.
각 수치의 범위는 입력 필드 참조를 따른다.

불편함 기록 예:

```json
{
  "exercise_item_id": null,
  "symptom_type": "pain",
  "severity": 6,
  "body_areas": ["무릎"],
  "detail": "운동 중 불편함",
  "action_taken": "adjust"
}
```

symptom_type: pain/fatigue/dizziness/breathing/other. severity: 0~10 또는 null.
action_taken: adjust/stop/continue. 조정 후 result.adjusted_items와 result.session으로 화면 갱신.

운동 후 피드백 예:

```json
{"perceived_difficulty":3,"post_condition":"good","uncomfortable_areas":[],"note":null}
```

perceived_difficulty 1~5. post_condition very_bad/bad/normal/good/very_good.
분석은 종료 상태와 피드백을 요구한다(미충족 409, 세션 없음 404).
analysis: generator, summary, metrics, feedback_summary, insights[], next_session_adjustments[], safety_notice.
분석은 현재 rules_v1이다. 다음 운동 조정 문구가 실제 다음 추천에 반영되는지까지 보장하는 계약은 아니다.

## 5. 운동 목표·기록·진행 현황 (5개)

| Method | 경로 | 입력 | 성공 응답 | 코드 |
|---|---|---|---|---|
| GET | `/api/exercise/goals/active` | 없음 | `goal` 또는 null | 200 |
| PUT | `/api/exercise/goals/active` | ExerciseGoalRequest | `ok, goal` | 200 |
| GET | `/api/exercise/history` | query: `from_date, to_date` 필수 | `period, count, history[]` | 200 |
| GET | `/api/exercise/progress` | query: `period=week/month/three_months`, 기본 month | `progress` | 200 |
| GET | `/api/exercise/summary` | 없음 | `summary.recent_7_days, summary.cumulative` | 200 |

```json
{"goal_type":"maintenance","weekly_frequency":3,"weekly_duration_minutes":120,"goal_period_weeks":8,"starts_on":"2026-09-08"}
```

주간 횟수 1~7, 시간 1~10080분, 목표 기간 1~260주. starts_on 생략 시 서버 오늘 날짜.
history의 각 원소는 session, logs, feedback. progress는 period, goal, summary,
weekly_trend[], category_distribution[], achievements를 가진다.
summary: workout_count, exercise_count, duration_minutes, calories_burned,
target_workout_count, target_duration_minutes, goal_achievement_rate.
목표가 없으면 목표 관련 값은 null일 수 있다.

기록 기간은 from_date ≤ to_date, 차이 최대 366일(양 끝 포함 최대 367일).
**현재 일반 운동 history와 식사 meal-logs API의 날짜 경계는 UTC**, 챗봇 요약의 날짜 경계는 KST다.
같은 '오늘'이어도 결과가 달라질 수 있으므로 실제 서비스 연동 전 날짜 기준 통일이 필요하다.
progress는 서버 date.today 기준이며 three_months는 이번 달과 앞선 두 달의 첫날부터 오늘까지다.
summary는 완료 상태 세션을 기준으로 최근 7일(오늘 포함 7일)과 누적 운동 횟수, 완료 종목 수, 시간, 열량, 활동일을 반환한다.
채팅 이외 목록 API에는 일반화된 페이지네이션이 없다. 대량 데이터 완전 조회를 보장하지 않는다.

## 6. 식단·냉장고 (6개)

| Method | 경로 | 입력 | 성공 응답 | 코드 |
|---|---|---|---|---|
| GET | `/api/diet/inventory` | 없음 | `count, inventory[]` | 200 |
| POST | `/api/diet/inventory` | FoodInventoryCreateRequest | `ok, item` | 201 |
| GET | `/api/diet/recommendations/latest` | 없음 | `result` 또는 null | 200 |
| POST | `/api/diet/recommendations/generate` | `{}` | `ok, generator, result` | 200 |
| POST | `/api/diet/meals/{diet_meal_id}/feedback` | DietMealFeedbackRequest | `ok, result.feedback, result.meal_log` | 200 |
| GET | `/api/diet/meal-logs` | query: `from_date, to_date` 필수 | `period, count, logs[]` | 200 |

재료 추가 예:

```json
{"name":"두부","quantity":1,"unit":"모","purchased_on":"2026-09-08","expires_on":"2026-09-12"}
```

name만 필수(1~100자). quantity 0~100000, unit 최대 20자. 구매일이 있으면 유통기한은 구매일 이후.
result.recommendation: diet_recommendation_id, recommendation_date, target_calories,
target_carbohydrates, target_protein, target_fat, recommendation_summary, ai_reason, status.
result.meals[]: diet_meal_id, meal_type, meal_order, recommended_calories, recommendation_note, status, foods[].
foods[]: food_name, quantity, unit, calories, carbohydrates, protein, fat 등.
식단 생성도 현재 rules_v1이며 팀원 모델과 연결된 것으로 가정하면 안 된다.

추천 식단을 그대로 먹었을 때:

```json
{"feedback_type":"eaten","eaten_at":"2026-09-08T12:30:00+09:00","actual_items":[]}
```

다른 음식을 먹었을 때:

```json
{"feedback_type":"different_food","eaten_at":"2026-09-08T12:30:00+09:00","actual_items":[{"food_name":"김치볶음밥","quantity":300,"unit":"g","calories":480,"carbohydrates":72,"protein":14,"fat":13}]}
```

feedback_type: eaten/different_food/skipped. different_food만 actual_items 1~20개가 필요하다.
나머지 유형은 actual_items를 비운다. eaten_at 생략 시 서버 현재 UTC 시각.
음식의 food_name, quantity(0 초과), unit은 필수, 영양소는 선택이며 null 가능.
logs[]는 각 식사에 items[]를 포함한다. skipped의 result.meal_log는 null일 수 있다.
이 API는 diet_meal_id와 연결된 기록이다. 추천 식단과 무관한 독립 식사 등록 API는 아직 없다.

## 7. 챗봇 (7개)

| Method | 경로 | 입력 | 성공 응답 | 코드 |
|---|---|---|---|---|
| POST | `/api/chats` | 생략 또는 `{title:null}` | `chat` | 201 |
| GET | `/api/chats` | status 선택, limit 기본20/최대50, cursor 선택 | `chats[], next_cursor, has_more` | 200 |
| PATCH | `/api/chats/{chat_id}` | title/status 하나 이상 | `chat` | 200 |
| GET | `/api/chats/{chat_id}/messages` | limit 기본30/최대100, before 선택 | `chat_id, messages[], next_cursor, has_more` | 200 |
| POST | `/api/chats/{chat_id}/messages` | client_message_id UUID, content 1~500자 | `is_replay, chat, user_message, assistant_message` | 신규201/재전송200 |
| POST | `/api/chats/answer-preview` | content 1~500자 | `answer` | 200 |
| POST | `/api/chats/health-score-preview` | mode latest/change(기본 latest), explain 기본false | `answer` | 200 |

마지막 두 개는 **저장하지 않는 개발용 미리보기**다. 실제 화면의 대화 저장에는 messages 전송 API를 쓴다.

```json
{"client_message_id":"00000000-0000-4000-8000-000000000001","content":"이번 주 운동 몇 번 했어?"}
```

예제 UUID는 문서용이다. 프론트는 질문마다 새 UUID를 만들고 재시도에는 같은 UUID와 내용을 사용한다.
정식 말풍선: **assistant_message.content**, 미리보기 말풍선: **answer.content**.
메시지 ID로 중복 말풍선을 방지한다. 같은 요청 ID로 다른 내용·다른 채팅방 전송은 409.
채팅 상태는 active/archived. 팝업 닫기만으로 archived 처리하지 않는다.
메시지 페이지는 최신 구간을 과거→최신 순서로 반환한다. 이전 페이지는 before=next_cursor로 받고 앞에 붙인다.
목록의 updated_at 변경 중에는 snapshot이 보장되지 않으므로 chat_id로 중복 제거한다.

답변은 content, intent, response_source, needs_more_data, evidence[], required_data[]를 포함한다.
정식 메시지에는 message_id, chat_id, sender_type, created_at이 추가된다.
출처: database/database_ai/general_ai/need_more_data. **현재 생성하는 것은 database와 need_more_data**다.
건강 점수 최신·이전 비교, 식사·운동 기록 요약을 지원한다. 기록 기간은 오늘/어제/이번 주/지난주/최근 7일.
명시적인 루틴 생성 요청(예: `오늘 운동 루틴 만들어줘`)은 운동 설정과 미사용 추천 컨텍스트가 있으면 기존 추천 생성·저장 흐름을 실행한다. 답변 intent는 exercise_routine_generation이며 evidence에 exercise_recommendation_id와 다음 `/api/exercise/sessions/start` 경로가 들어간다. 입력이 부족하면 required_data에 exercise_preferences 또는 recommendation_context를 반환한다. answer-preview는 쓰기 없이 준비 상태만 확인한다.
그 밖의 임의 자연어·후속 대화 문맥·모델 해석은 아직 지원하지 않는다. 모델은 팀원 개발 완료, 백엔드 접속 규격은 미확인.
보관기간은 메시지 생성 후 30일(720시간)이다. 5분 주기로 만료 메시지를 삭제한다. 상세는 [보관 정책](chat-retention-policy.md)을 따른다. 요청 제한은 구현했고 AI 연동은 미완료이다.

## 8. 화면별 호출 순서

| 화면·흐름 | 프론트 호출 순서 |
|---|---|
| 가입 후 정보 입력 | Supabase Auth → PATCH profile → GET/PUT allergies → POST onboarding/complete |
| 운동 추천 | PUT preferences → POST recommendation-contexts → POST recommendations/generate → result로 화면 표시 |
| 운동 수행 | POST sessions/start → 항목마다 POST items/{item_id} → POST complete → PUT feedback → GET analysis |
| 수행 중 불편함 | POST discomfort → 반환 session/adjusted_items로 남은 화면 갱신 |
| 운동 목표·기록 | GET/PUT goals/active, 기간을 선택해 GET history/progress |
| 식단 | GET inventory → 필요한 재료 POST → GET latest 또는 POST generate → 식사별 POST feedback → GET meal-logs |
| 챗봇 재진입 | GET chats?status=active&limit=1 → 없으면 POST chats → GET messages |
| 챗봇 질문 | UUID 생성 → POST messages → assistant_message 표시 → 실패 시 같은 UUID로 재시도 |

## 9. 오류·재시도 협업 규칙

- 401: 토큰 갱신·재로그인 처리. 기존 토큰이 만료됐으면 새 access_token 사용.
- 404: 없는 데이터 또는 챗봇 타 사용자 접근. 빈 화면/안내로 처리.
- 409: 사전 단계 누락, 보관된 채팅, 중복 ID 충돌 등. 무조건 자동 재시도하지 말고 원인 표시.
- 422: 요청 필드·범위 오류. 입력 수정 안내.
- 502: DB/외부 서비스 오류. 입력을 보존하고 재시도 제공.
- 현재 운동 session RPC 실패는 원인과 무관하게 409로 매핑되는 한계가 있다.
- 챗봇 오류: `{"detail":{"code":"VALIDATION_ERROR","message":"입력값을 확인해 주세요.","fields":["body.content"]}}`.
- 다른 API 오류: detail이 문자열 또는 FastAPI 검증 오류 배열, 온보딩은 message/fields 객체일 수 있다.
- 프론트 공통 오류 처리기는 detail의 문자열/객체/배열을 구분해야 한다. 아직 전체 API 오류 규격이 통일되지 않았다.
- 저장 채팅의 handler 제한 30초(인증 시간 별도). 타임아웃이어도 DB 저장 성공 가능 → 같은 client_message_id로 재시도.
- 채팅 외 POST의 중복 방지 보장을 일반화하지 않는다. 연속 클릭을 막고 상태 조회 후 재시도한다.
- 429 요청 제한: 사용자별 최근 60초간 전체 60회, 답변 생성 10회. `detail.retry_after`초 후 같은 요청 ID로 재시도한다. 상세는 [요청 제한](chat-rate-limits.md)을 따른다.

## 10. 최종 UI 대비 아직 없는 전용 API

아래는 UI 요구사항이다. 구현된 경로가 없으므로 프론트가 임의 URL을 가정하면 안 된다.

| 화면 요구 | 현재 공백 |
|---|---|
| 마이페이지 초기 표시 | GET profile 전용 조회 없음 |
| 프로필 사진·키·현재 체중·선호 운동 편집 | 현재 PATCH profile 필드로 모두 지원되지 않음 |
| 건강 문서 업로드·촬영·OCR 검토·수정 | 업로드/OCR API 없음 |
| 건강 데이터 상세·삭제, 종합 건강 분석 | 전용 API 없음. 챗봇 건강 점수 조회와 별도 |
| 월간 건강 리포트·인바디 변화 | 전용 API 없음. 운동 progress와 별도 |
| 냉장고 재료 수정·다중 삭제 | GET/POST만 있음 |
| 음식 검색·사진 인식·독립 식사 추가·수정 | 전용 API 없음 |
| 특정 날짜 식단·끼니 하나 교체 | 현재 latest/generate로 동일 기능을 보장하지 않음 |
| 알림 설정·방해금지·푸시 | 전용 API 없음 |
| 회원 탈퇴·연관 데이터 삭제 | 전용 API 없음 |
| 운동 동영상·세트별 재개·연속 목표 성취 | 현재 API와 최종 UI 요구를 추가 대조해야 함 |

## 11. 검증 상태와 담당

전체 자동 테스트 259개 통과 기록. 발표 시나리오 로컬 API 흐름 검증을 포함한다. 챗봇 저장/건강 점수는 실제 Supabase 연동 24개 검증 완료.
신규 챗봇 식사·운동은 모의 HTTP 검증 완료, 실제 DB 통합은 남아 있다.
나머지 31개 API는 이번 인수인계에서 코드·SQL을 확인한 것이며 전부 최신 실연동 검증한 것은 아니다.

| 담당 | 인수인계 작업 |
|---|---|
| 백엔드 | 공유 서버 주소, CORS 허용 origin, 응답 타입 보완, 누락 API·모델 연동, 오류 대응 |
| 프론트 | 토큰 전달, 화면 API 연결, ID 보관, 로딩/빈 데이터/null/오류 처리, 재시도 중복 방지 |
| 모델 담당 | 모델 호출 주소 또는 Python 실행 방식, 입력·출력 JSON, 인증·제한·타임아웃 전달 |
| 공동 | 날짜 기준 통일, 응답 샘플 확인, 실제 화면 시나리오 테스트, 보관기간 기산점 확정 |
