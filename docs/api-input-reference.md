# Auto-Fit 전체 API 입력 필드 참조

기준: 2026-09-09 로컬 FastAPI OpenAPI. 총 39개 operation. 코드 자동 추출이며 실제 서버 배포 상태를 보증하지 않는다.

인증·호출 순서·응답 형태·추가 검증은 [프론트엔드 협업 안내](frontend-api-handoff.md), 원본은 [openapi.json](openapi.json)을 참고한다.

주의: 코드가 일반 Header로 인증을 받으므로 OpenAPI의 Authorization optional 표시는 인증 면제를 뜻하지 않는다. /health 외 모든 API에는 유효한 Bearer 토큰이 필요하다. 응답 스키마의 object는 아직 구체적인 응답 타입이 없음을 뜻한다.

## GET /health

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/test/roundtrip

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **RoundtripRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/profile

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PATCH /api/profile

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ProfileUpdateRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/allergies

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PUT /api/allergies

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **AllergySelectionRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/onboarding/complete

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **CompleteOnboardingRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/preferences

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PUT /api/exercise/preferences

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExercisePreferencesRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/recommendation-contexts/latest

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/recommendation-contexts

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExerciseRecommendationContextRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/recommendations/latest

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/recommendations/generate

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **GenerateExerciseRecommendationRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/sessions/start

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **StartExerciseSessionRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/sessions/{session_id}/items/{item_id}

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| path | item_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExerciseItemResultRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/sessions/{session_id}/complete

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **CompleteExerciseSessionRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/sessions/latest

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/exercise/sessions/{session_id}/discomfort

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExerciseDiscomfortRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/sessions/{session_id}/discomfort

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PUT /api/exercise/sessions/{session_id}/feedback

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExerciseSessionFeedbackRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/sessions/{session_id}/feedback

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/sessions/{session_id}/analysis

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | session_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/goals/active

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PUT /api/exercise/goals/active

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ExerciseGoalRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/history

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| query | from_date | 예 | string (date) | — |
| query | to_date | 예 | string (date) | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/exercise/progress

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| query | period | 아니오 | string | enum=["week","month","three_months"]; default="month" |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/diet/inventory

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/diet/inventory

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **FoodInventoryCreateRequest**

OpenAPI에 명시된 상태 코드: 201, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/diet/recommendations/latest

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/diet/recommendations/generate

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **GenerateDietRecommendationRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/diet/meals/{diet_meal_id}/feedback

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | diet_meal_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **DietMealFeedbackRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/diet/meal-logs

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| query | from_date | 예 | string (date) | — |
| query | to_date | 예 | string (date) | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/chats/health-score-preview

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **HealthScorePreviewRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/chats/answer-preview

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ChatAnswerPreviewRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/chats

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 생략 가능, 타입: **CreateChatRequest 또는 null**

OpenAPI에 명시된 상태 코드: 201, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/chats

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| query | status | 아니오 | string 또는 null | — |
| query | limit | 아니오 | integer | maximum=50; minimum=1; default=20 |
| query | cursor | 아니오 | string 또는 null | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## PATCH /api/chats/{chat_id}

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | chat_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **UpdateChatRequest**

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## GET /api/chats/{chat_id}/messages

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | chat_id | 예 | string (uuid) | — |
| query | limit | 아니오 | integer | maximum=100; minimum=1; default=30 |
| query | before | 아니오 | string 또는 null | — |
| header | authorization | 아니오 | string 또는 null | — |

요청 본문 없음.

OpenAPI에 명시된 상태 코드: 200, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## POST /api/chats/{chat_id}/messages

| 위치 | 이름 | 필수 | 타입 | 조건 |
|---|---|---|---|---|
| path | chat_id | 예 | string (uuid) | — |
| header | authorization | 아니오 | string 또는 null | — |

JSON 본문: 필수, 타입: **ChatMessageRequest**

OpenAPI에 명시된 상태 코드: 201, 422. 런타임 인증·상태·DB 오류는 협업 안내 참고.

## 본문 타입 필드

기본값이 명시되지 않은 선택 필드는 서버 default_factory를 사용할 수 있다. 사용자 정의 검증은 아래 표에 자동 표현되지 않는다.

### AllergySelectionRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| allergy_type_ids | 아니오 | 배열<string (uuid)> | maxItems=12 |
| custom_names | 아니오 | 배열<string> | maxItems=5 |

### ChatAnswerPreviewRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| content | 예 | string | maxLength=500; minLength=1 |

### ChatMessageRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| content | 예 | string | maxLength=500; minLength=1 |
| client_message_id | 예 | string (uuid) | — |

### CompleteExerciseSessionRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|

### CompleteOnboardingRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|

### CreateChatRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| title | 아니오 | string 또는 null | — |

### DietMealFeedbackRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| feedback_type | 예 | string | enum=["eaten","different_food","skipped"] |
| eaten_at | 아니오 | string (date-time) | — |
| actual_items | 아니오 | 배열<MealLogItemRequest> | maxItems=20 |

### ExerciseDiscomfortRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| exercise_item_id | 아니오 | string (uuid) 또는 null | — |
| symptom_type | 예 | string | enum=["pain","fatigue","dizziness","breathing","other"] |
| severity | 아니오 | integer 또는 null | — |
| body_areas | 아니오 | 배열<string> | maxItems=10 |
| detail | 아니오 | string 또는 null | — |
| action_taken | 예 | string | enum=["adjust","stop","continue"] |

### ExerciseGoalRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| goal_type | 예 | string | enum=["weight_loss","muscle_gain","endurance","maintenance","rehabilitation"] |
| weekly_frequency | 예 | integer | maximum=7; minimum=1 |
| weekly_duration_minutes | 예 | integer | maximum=10080; minimum=1 |
| goal_period_weeks | 예 | integer | maximum=260; minimum=1 |
| starts_on | 아니오 | string (date) | — |

### ExerciseItemResultRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| completed | 예 | boolean | — |
| skipped | 예 | boolean | — |
| duration_minutes | 아니오 | integer 또는 null | — |
| completed_sets | 아니오 | integer 또는 null | — |
| performed_repetitions | 아니오 | integer 또는 null | — |
| performed_weight_kg | 아니오 | number 또는 string 또는 null | — |
| note | 아니오 | string 또는 null | — |
| skip_reason | 아니오 | string 또는 null | — |

### ExercisePreferencesRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| goal_type | 예 | string | enum=["weight_loss","muscle_gain","endurance","maintenance","rehabilitation"] |
| experience_level | 예 | string | enum=["beginner","intermediate","advanced"] |

### ExerciseRecommendationContextRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| available_minutes | 예 | integer | maximum=300; minimum=5 |
| location | 예 | string | enum=["gym","home","outdoor","other"] |
| available_equipment | 아니오 | 배열<string> | maxItems=5 |
| condition_level | 예 | string | maxLength=30; minLength=1 |
| discomfort_areas | 아니오 | 배열<string> | maxItems=10 |
| condition_note | 아니오 | string 또는 null | — |

### ExerciseSessionFeedbackRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| perceived_difficulty | 예 | integer | maximum=5; minimum=1 |
| post_condition | 예 | string | enum=["very_bad","bad","normal","good","very_good"] |
| uncomfortable_areas | 아니오 | 배열<string> | maxItems=10 |
| note | 아니오 | string 또는 null | — |

### FoodInventoryCreateRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| name | 예 | string | maxLength=100; minLength=1 |
| quantity | 아니오 | number 또는 string 또는 null | — |
| unit | 아니오 | string 또는 null | — |
| purchased_on | 아니오 | string (date) 또는 null | — |
| expires_on | 아니오 | string (date) 또는 null | — |

### GenerateDietRecommendationRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|

### GenerateExerciseRecommendationRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|

### HTTPValidationError

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| detail | 아니오 | 배열<ValidationError> | — |

### HealthScorePreviewRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| mode | 아니오 | string | enum=["latest","change"]; default="latest" |
| explain | 아니오 | boolean | default=false |

### MealLogItemRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| food_name | 예 | string | maxLength=100; minLength=1 |
| quantity | 예 | number 또는 string | — |
| unit | 예 | string | maxLength=20; minLength=1 |
| calories | 아니오 | number 또는 string 또는 null | — |
| carbohydrates | 아니오 | number 또는 string 또는 null | — |
| protein | 아니오 | number 또는 string 또는 null | — |
| fat | 아니오 | number 또는 string 또는 null | — |

### ProfileUpdateRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| name | 아니오 | string 또는 null | — |
| nickname | 아니오 | string 또는 null | — |
| birth_date | 아니오 | string (date) 또는 null | — |
| gender | 아니오 | string 또는 null | — |
| target_weight | 아니오 | number 또는 string 또는 null | — |
| activity_level | 아니오 | string 또는 null | — |

### RoundtripRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| message | 예 | string | maxLength=200; minLength=1 |

### StartExerciseSessionRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|

### UpdateChatRequest

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| title | 아니오 | string 또는 null | — |
| status | 아니오 | string 또는 null | — |

### ValidationError

| 필드 | 필수 | 타입 | 조건 |
|---|---|---|---|
| loc | 예 | 배열<string 또는 integer> | — |
| msg | 예 | string | — |
| type | 예 | string | — |
| input | 아니오 | object | — |
| ctx | 아니오 | object | — |
