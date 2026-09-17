# 홈 화면 로딩 개선 전달사항

## 적용 순서

1. 백엔드 변경을 Render 개발 API에 배포한다. 현재 문서의 API는 로컬 구현 완료 상태이며 배포 전에는 사용할 수 없다.
2. 프론트의 홈 요청을 `GET /api/home` 한 번으로 교체한다.
3. 실제 앱에서 최초 홈 표시 시간과 응답 매핑을 검증한다.

DB 마이그레이션이나 새로운 환경변수는 필요 없다. 기존 API는 유지한다.

## API 규격

`GET /api/home`

기존 `apiRequest`를 사용해 Supabase 액세스 토큰을 `Authorization: Bearer ...`로 전달한다.
사용자 ID는 보내지 않는다. 서버가 검증한 사용자 본인의 프로필과 최근 두 건강 평가만 조회한다.

응답 예시:

```json
{
  "user_name": "홍길동",
  "health_score": {
    "score": 86.0,
    "total_score": 100,
    "assessed_at": "2026-09-17T00:00:00Z"
  },
  "score_change": {
    "change": 5.0,
    "previous_score": 81.0,
    "previous_assessed_at": "2026-09-10T00:00:00Z",
    "comparison": "previous_assessment",
    "message": "이전 평가보다 건강 점수가 5점 높아졌습니다."
  }
}
```

| 상황 | 응답 |
|---|---|
| 평가 없음 | 200, `score`, `assessed_at`, `change`, 이전 평가 필드 모두 `null` |
| 평가 한 건 | 200, 현재 점수 제공, `change`와 이전 평가 필드는 `null` |
| 점수 동일 | `change: 0` (데이터 없음과 구분) |
| 이름이 없거나 공백 | `user_name: "회원"` |
| 토큰 누락·만료 | 401 |
| 프로필 행 없음 | 404 |
| 점수 조회 실패 | 502; 데이터 없음으로 처리하지 않음 |

변화량은 **최근 평가와 바로 이전 평가의 차이**다. 주간 변화가 아니므로 화면 문구는
‘이전 평가 대비’로 표시한다. `message`도 주간 추이나 개선 원인을 단정하지 않는다.
‘우수’ 같은 상태 판정은 제공하지 않으므로 프론트에서 임의로 채우지 않는다.
응답에는 `Cache-Control: no-store`를 설정한다.

## 프론트 수정

`src/api/home.ts`에 다음 타입과 호출을 추가한다.

```ts
export type HomeResponse = {
  user_name: string;
  health_score: {
    score: number | null;
    total_score: number;
    assessed_at: string | null;
  };
  score_change: {
    change: number | null;
    previous_score: number | null;
    previous_assessed_at: string | null;
    comparison: 'previous_assessment';
    message: string;
  };
};

export function getHome() {
  return apiRequest<HomeResponse>('/api/home', { method: 'GET' });
}
```

`app/(tabs)/home.tsx`의 홈 로딩에서 다음 호출을 제거한다.

- `getHealthScorePreview('latest', false)`
- `getHealthScorePreview('change', true)`
- `getProfile()`
- `getSessionUserName()` 및 위 요청들을 묶은 `Promise.allSettled`

`getHome()` 응답을 기존 상태에 다음처럼 연결한다.

```ts
const data = await getHome();
setUserName(data.user_name);
setHealthScore({
  score: data.health_score.score ?? undefined,
  totalScore: data.health_score.total_score,
});
setWeeklyProgress({
  change: data.score_change.change ?? undefined,
  message: data.score_change.message,
});
setLoadState('ready');
```

기존 `HomeHealthScore`와 `HomeWeeklyProgress` 타입을 유지하는 예시다.
`HealthScore`의 `status`에는 기존 `null` 처리를 유지한다.
변화 카드의 주간 라벨은 ‘이전 평가 대비’로 변경한다.
`answer`에서 값을 추측하는 `getStructuredHealthScore`와
`getStructuredWeeklyProgress`는 홈 경로에서 제거한다.

최초 로딩에는 placeholder를 표시하고 실패 시 명시적인 오류와 재시도를 제공한다.
기존 정보가 있는 상태에서 갱신에 실패하면 기존 정보를 유지하고 갱신 실패를 표시한다.
로그아웃·계정 변경 시 홈 상태를 비워 다른 계정의 정보가 남지 않게 한다.
배포 후에는 이전 홈 호출을 병행하지 않아야 중복 요청이 사라진다.

## 백엔드 변경 및 검증

- 홈 데이터용 클라이언트 요청: 세 개에서 한 개로 감소.
- 정상 홈 경로의 Supabase 요청: 인증 한 번 + 프로필 한 번 + 점수 한 번.
- 인증 후 프로필과 점수를 병렬 조회한다. 운동 설정·평가 상세·챗봇 제한 RPC는 호출하지 않는다.
- lifespan에 생성한 HTTP 클라이언트를 인증과 홈 조회에 재사용하고 종료 시 닫는다.
- 인증/서비스 키는 요청별 헤더로만 전달하며 사용자 응답을 서버에 캐시하지 않는다.
- 기존 챗봇 제한은 유지한다. 새 홈 API는 일반 조회 경로이며 챗봇 제한을 소비하지 않는다.
- HTTP 연결 재사용은 인증과 새 홈 경로에 적용했다. 다른 데이터 API 전체를 리팩터링하지 않았다.

자동 테스트로 인증 거절, 사용자별 조회 조건, 현재·이전 평가 누락, 양수·음수·0 변화량,
외부 점수 조회 오류, 병렬 조회, 요청 간 클라이언트 재사용과 종료를 확인한다.

실제 배포 앱의 5초 지연 개선 폭은 아직 측정하지 않았다. 프론트 연동 후 홈 진입 → 요청 시작 →
응답 완료 → 정보 표시 시간을 측정한다. 토큰·응답 본문은 성능 로그에 기록하지 않는다.
Render가 깨어 있는 상태와 장시간 유휴 후 첫 실행을 구분해 비교한다.
