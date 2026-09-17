# 프론트엔드 식단 이미지 연동 안내

## 바로 사용할 정보

- 공용 API Base URL: `https://auto-fit-api-dev.onrender.com`
- Swagger: `https://auto-fit-api-dev.onrender.com/docs`
- 인증: 모든 사용자 API 요청에 Supabase 액세스 토큰을 보낸다.
- 현재 허용된 웹 Origin: `http://localhost:3000`, `http://localhost:8081`

```http
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Content-Type: application/json
```

Render 무료 인스턴스가 유휴 상태이면 첫 요청에 재시작 시간이 걸릴 수 있다.

## 식단 조회 API

오늘 또는 최근 활성 식단:

```http
GET /api/diet/recommendations/latest
```

날짜별 식단:

```http
GET /api/diet/recommendations?date=2026-09-16
```

식단이 없으면 `result`는 `null`이다. 식단을 새로 생성하려면 다음 요청을 사용한다.

```http
POST /api/diet/recommendations/generate
Content-Type: application/json

{}
```

## 식단 이미지 응답

각 `result.meals[]`에 아래 이미지 필드가 포함된다.

```json
{
  "diet_meal_id": "uuid",
  "meal_type": "breakfast",
  "recommended_calories": 400,
  "menu_image_key": "catalog:01",
  "image_storage_path": "menus/01.png",
  "image_url": "https://eeeqibyssajykrhvecbv.supabase.co/storage/v1/object/public/menu-images/menus/01.png",
  "image_source": "uploaded",
  "image_generation_status": "completed",
  "image_generation_required": false,
  "foods": []
}
```

| 필드 | 의미 | 프론트 처리 |
|---|---|---|
| `image_url` | 화면에 표시할 완성 이미지 URL | 값이 있으면 그대로 이미지 컴포넌트에 전달 |
| `image_storage_path` | Supabase Storage 내부 상대 경로 | 표시용 URL을 직접 조합하는 데 사용하지 않음 |
| `menu_image_key` | 이미지 캐시를 찾는 고유 키 | 화면 로직에서는 보관만 하고 수정하지 않음 |
| `image_source` | `uploaded` 또는 `generated` | 필요하면 디버그·관리 화면에 사용 |
| `image_generation_status` | `pending`, `generating`, `completed`, `failed` | 향후 생성 진행 상태 표시에 사용 |
| `image_generation_required` | 완성된 캐시 이미지가 없는지 표시 | `true`이면 기본 이미지를 표시 |

백엔드가 `foods[].food_name`을 정규화한 뒤 단백질·탄수화물·식재료 구성을 기준으로
기존 40장 중 가장 가까운 사진을 자동 선택한다. 따라서 프론트에서 음식 이름별 이미지 표를
만들거나 파일명을 직접 연결할 필요가 없다.

일치하는 사진이 없으면 백엔드는 음식 구성의 고유 키로 `menu_images` 캐시 항목을 한 번만
생성하고 상태를 `pending`으로 기록한다. 이미지 생성 모델은 아직 연결되지 않았으므로 이때
`image_url`은 `null`이며 프론트는 기본 이미지를 표시한다. 향후 작업자가 모델 결과를 Storage에
저장하고 같은 캐시 항목을 `completed`로 바꾸면, 다음 식단 조회부터 완성된 `image_url`이 반환된다.

## 권장 렌더링 코드

React Native 또는 Expo:

```tsx
type DietMeal = {
  diet_meal_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  recommended_calories: number | null;
  image_url: string | null;
  image_source: "uploaded" | "generated" | null;
  image_generation_status:
    | "pending"
    | "generating"
    | "completed"
    | "failed"
    | null;
  image_generation_required: boolean;
};

const imageSource = meal.image_url
  ? { uri: meal.image_url }
  : require("../assets/diet-placeholder.png");

<Image
  source={imageSource}
  resizeMode="cover"
  accessibilityLabel={`${meal.meal_type} 추천 식단`}
/>
```

React Web:

```tsx
<img
  src={meal.image_url ?? "/images/diet-placeholder.png"}
  alt={`${meal.meal_type} 추천 식단`}
  loading="lazy"
/>
```

`image_url`을 우선 사용한다. `image_storage_path`를 이용해 프론트에서 Supabase URL을
직접 만들지 않는다. 스토리지 정책이나 CDN 주소가 바뀌어도 API 응답만 변경하면 되기 때문이다.

## 요청 예시

```ts
const API_BASE_URL =
  "https://auto-fit-api-dev.onrender.com";

export async function fetchLatestDiet(accessToken: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/diet/recommendations/latest`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`식단 조회 실패: ${response.status}`);
  }

  return response.json();
}
```

## 프론트 처리 규칙

1. `result === null`이면 식단 없음 상태를 표시하거나 생성 API를 호출한다.
2. `meal.image_url`이 있으면 해당 사진을 표시한다.
3. `image_url`이 없으면 앱에 포함된 기본 식단 이미지를 표시한다.
4. 이미지 네트워크 로드가 실패해도 기본 이미지로 대체한다.
5. `image_generation_required`가 `true`여도 프론트에서 이미지 생성 API를 직접 호출하지 않는다.
   이미지 생성 작업은 추후 백엔드가 담당한다.
6. 이미지 URL이나 Storage 경로를 로컬에 영구 저장하지 않는다. 식단 조회 시 받은 최신 값을 사용한다.

## 현재 확인된 상태

- 기존 식단 사진 40장이 `menu_images` 캐시에 등록되어 있다.
- 40장 모두 음식 구성 태그가 등록되어 백엔드 자동 매칭에 사용된다.
- 아침·점심·저녁·간식 응답에서 실제 `image_url` 반환을 확인했다.
- 연결된 이미지 URL은 모두 HTTP 200과 `image/png`로 응답한다.
- 백엔드 전체 테스트 306개가 통과했다.
- FastAPI 공유 주소의 `/health`가 `{"status":"ok"}`로 응답한다.

## 문제 확인 순서

사진이 표시되지 않으면 다음 순서로 확인한다.

1. 식단 API 응답의 `image_url`이 `null`인지 확인한다.
2. `image_generation_status`와 `image_generation_required`를 확인한다.
3. `image_url`을 브라우저에서 직접 열어 HTTP 200인지 확인한다.
4. React Native라면 `Image`의 `onError` 로그를 확인한다.
5. API 요청이 실패하면 Supabase 액세스 토큰과 `Authorization` 헤더를 확인한다.

## 사용자 촬영 사진 연동 (2026-09-17 추가)

이 절의 API는 저장소 코드에 추가되었으며,
`20260917002044_add_meal_log_photos.sql`은 개발 Supabase에 적용 완료했다.
로컬 API와 실제 개발 DB 연동 검증 13개가 통과했으며, 공유 서버 배포는 대기 중이다.
위의 기존 확인 결과는 추천 이미지에 대한 이전 검증 결과이며 사용자 사진의 배포 검증 결과가 아니다.

1. `POST /api/diet/meals/{diet_meal_id}/feedback`에 `different_food`와 `actual_items`를 보내 식사 기록을 생성한다.
2. 응답의 `result.meal_log.meal_log_id`를 사용해 아래 API로 촬영 파일을 업로드한다.
3. 앱 재진입 시 `GET /api/diet/meal-logs?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`를 호출해
   `logs[].image_url`을 이미지 컴포넌트에 전달한다.

```http
POST /api/diet/meal-logs/{meal_log_id}/photo
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Content-Type: multipart/form-data; boundary=<client-generated>

file: <촬영한 이미지 파일>
```

`FormData`를 사용하며 `Content-Type` 헤더를 직접 지정하지 않는다. 클라이언트가 boundary를 생성해야 한다.
Expo/React Native에서는 로컬 URI가 가리키는 파일을 FormData에 넣어 전송한다.
로컬 URI 문자열 자체를 JSON으로 보내는 방식은 지원하지 않는다.

업로드 성공은 HTTP 201이며 응답은 다음과 같다.

```json
{
  "meal_log_id": "uuid",
  "image_storage_path": "user-uuid/meal-log-uuid/photo-uuid.jpg",
  "image_url": "https://<project>.supabase.co/storage/v1/object/sign/meal-photos/...?token=...",
  "image_url_expires_in": 3600
}
```

식단 기록 조회의 `logs[]`에도 같은 이미지 필드가 포함된다. 사진이 없으면 세 필드는 `null`이다.
DB에는 기존 `meal_logs.photo_storage_path` 컬럼에 영구 경로를 저장하고,
비공개 `meal-photos` 버킷의 파일을 조회할 때마다 1시간 유효한 서명 URL을 새로 발급한다.
URL을 영구 저장하지 않으며 만료 시 식단 기록을 다시 조회한다.
추천 이미지는 기존 `result.meals[].image_url`, 실제 촬영 이미지는 `logs[].image_url`을 사용한다.

- `MealLogItemRequest`는 음식의 영양 정보이며 이미지 필드를 추가하지 않는다. 사진은 식사 기록 전체에 한 장 연결된다.
- JPEG, PNG, WebP 파일을 지원하며 최대 5 MiB이다. HEIC는 업로드 전 JPEG 등으로 변환한다.
- 기존 사진이 있는 기록은 HTTP 409를 반환한다. 현재 API는 사진 교체·삭제를 지원하지 않는다.
- 존재하지 않거나 다른 사용자의 기록은 HTTP 404, 인증 누락은 401, 용량 초과는 413, 미지원 형식은 415이다.
- 식사 저장 후 업로드가 실패하면 식사 기록은 유지된다. 사진 업로드만 재시도한다.
  업로드 응답을 받지 못했다면 먼저 식단 기록을 조회해 사진이 저장되었는지 확인한다.
- Storage/DB 오류는 502이다. DB 저장 실패 시 새로 업로드한 파일 정리를 시도한다.
- 피드백 수정으로 식사 기록이 유지되는 경우 사진도 유지된다. `skipped`로 바꾸면 해당 기록은 조회 대상에서 제외된다.
- 앱 구현 소스는 이 저장소에 없으므로 실제 화면의 fixture 대체와 업로드 호출은 프론트 저장소에서 적용해야 한다.
