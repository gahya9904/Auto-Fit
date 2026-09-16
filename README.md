# Auto-Fit

Auto-Fit은 건강 데이터, 식단, 운동 정보를 한곳에서 관리할 수 있도록 구성한 React Native 기반 건강 관리 애플리케이션입니다. Expo Router를 사용해 Android, iOS, Web 화면을 하나의 코드베이스로 구성했으며, Supabase Auth와 별도 백엔드 API를 통해 인증·온보딩·AI 챗봇 기능을 제공합니다.

현재 저장소에서 실행 가능한 애플리케이션은 `frontend`에 구현되어 있습니다. `backend`, `ai`, `docs` 디렉터리는 현재 빈 자리 표시자이며 서버 또는 AI 구현 코드는 포함하지 않습니다.

## 주요 기능

- 이메일/비밀번호 로그인과 Google·Kakao OAuth 로그인
- 4단계 회원가입
  - 기본 정보와 약관 동의
  - 이메일 OTP 인증
  - 알레르기 선택
  - 운동 목표와 운동 경험 설정
- 카메라 촬영 및 문서 선택을 통한 건강 데이터 업로드 UI
- 건강검진·인바디 OCR 결과 확인 및 항목별 수정 UI
- 건강 지표 요약, 추천 이유, 판정 기준을 제공하는 종합 건강 분석 UI
- 건강 점수와 주간 진행 상황을 보여 주는 홈 화면
- 날짜별 추천 식단, 영양 목표, 식사 상태 및 직접 식사 기록 관리
- 운동 조건 입력, 맞춤 루틴 요약 및 운동 완료 상태 관리
- 홈 화면의 플로팅 AI 챗봇과 서버 대화 기록 동기화
- Safe Area, 작은 화면, Web을 고려한 반응형 레이아웃과 커스텀 하단 내비게이션

## 현재 구현 범위

기능별 데이터 출처가 서로 다르므로 개발 시 아래 상태를 참고하세요.

| 영역                             | 현재 상태                                                                |
| -------------------------------- | ------------------------------------------------------------------------ |
| 로그인·회원가입                  | Supabase Auth 연동                                                       |
| 프로필·알레르기·운동 선호 온보딩 | 백엔드 API 연동                                                          |
| AI 챗봇                          | 백엔드 API 연동, 로컬 세션 캐시와 메시지 중복 제거 적용                  |
| 건강 데이터 파일 선택            | 카메라 및 문서 선택 기능 구현                                            |
| OCR 처리                         | 화면과 수정 흐름은 구현되어 있으나 OCR/KIE 결과는 mock 데이터 사용       |
| 종합 건강 분석                   | 화면과 상호작용은 구현되어 있으나 분석 결과는 mock 데이터 사용           |
| 홈 건강 점수                     | mock 데이터 사용                                                         |
| 식단                             | 화면, 날짜별 상태, 냉장고 및 식사 기록 흐름은 로컬 상태/mock 데이터 기반 |
| 운동 루틴                        | 조건 입력과 루틴 흐름은 구현되어 있으나 추천 루틴은 mock 데이터 기반     |
| 마이                             | 화면 자리 표시자만 구현                                                  |
| 비밀번호 찾기·재설정             | UI와 화면 이동만 구현되어 있으며 Supabase 복구 요청은 미연동             |

## 기술 스택

| 구분         | 기술                                                   |
| ------------ | ------------------------------------------------------ |
| 애플리케이션 | Expo 57, React Native 0.86, React 19                   |
| 라우팅       | Expo Router 57, Typed Routes                           |
| 언어         | TypeScript 6 (`strict` 모드)                           |
| Web          | React Native Web, Metro, static output                 |
| 인증·세션    | Supabase JS, AsyncStorage                              |
| UI           | React Native StyleSheet, Safe Area Context, Reanimated |
| SVG          | react-native-svg, react-native-svg-transformer         |
| 파일 입력    | Expo Image Picker, Expo Document Picker                |
| 날짜 입력    | React Native Community DateTimePicker 및 Web 전용 구현 |
| 품질 관리    | ESLint, Prettier, TypeScript                           |

## 프로젝트 구조

```text
Auto-Fit/
├─ ai/                         # 현재 자리 표시자
├─ backend/                    # 현재 자리 표시자
├─ docs/                       # 현재 자리 표시자
├─ frontend/                   # Expo 애플리케이션
│  ├─ app/                     # Expo Router 파일 기반 라우트
│  │  ├─ (auth)/               # 로그인, OAuth callback, 회원가입, 비밀번호 화면
│  │  ├─ (health-data)/        # 업로드, OCR 결과, 종합 분석, 시작 안내
│  │  ├─ (tabs)/               # 홈, 식단, 운동, 마이 및 탭 레이아웃
│  │  ├─ exercise/             # 운동 조건 입력과 맞춤 운동 요약
│  │  ├─ _layout.tsx           # 전역 Provider, 폰트, Safe Area, Stack 설정
│  │  ├─ index.tsx             # 최초 진입 라우트
│  │  └─ splash.tsx            # 앱 시작 화면
│  ├─ assets/                  # 폰트, SVG 아이콘, 배경 및 일러스트 이미지
│  ├─ src/
│  │  ├─ api/                  # 인증 헤더가 포함된 API client, chat/onboarding API
│  │  ├─ components/           # 공통·인증·분석·식단·운동·홈·내비게이션 UI
│  │  ├─ features/             # 도메인 상태와 데이터 처리
│  │  ├─ lib/                  # Supabase client
│  │  ├─ theme/                # 색상, 폰트, 간격, radius, shadow, typography
│  │  ├─ types/                # 공통 타입
│  │  └─ utils/                # 식단 mock 분석 등 유틸리티
│  ├─ .env.example             # 공개 환경 변수 이름 예시
│  ├─ app.json                 # Expo 앱 설정
│  ├─ eas.json                 # EAS 빌드 프로필
│  ├─ metro.config.js          # SVG transformer 설정
│  └─ package.json
└─ README.md
```

## 주요 화면 및 기능

### 인증 및 회원가입

| 경로                                  | 기능                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `/login`                              | 이메일 로그인, Google·Kakao OAuth, 회원가입/비밀번호 화면 진입         |
| `/auth/callback`                      | OAuth callback URL에서 Supabase 세션 생성                              |
| `/signup/step1`                       | 이메일, 비밀번호, 이름, 생년월일, 성별, 약관 검증 후 Supabase 회원가입 |
| `/signup/step2`                       | 6자리 이메일 OTP 검증 및 인증 메일 재전송                              |
| `/signup/step3`                       | 알레르기 및 기타 알레르기 저장                                         |
| `/signup/step4`                       | 운동 목표·경험 저장과 온보딩 완료                                      |
| `/password/forgot`, `/password/reset` | 비밀번호 찾기·재설정 UI                                                |

회원가입 중 필요한 값은 `SignupContext`에 보관합니다. 비밀번호는 Step 1의 로컬 상태에서만 사용하며 회원가입 Context에 저장하지 않습니다.

### 건강 데이터 흐름

| 경로              | 기능                                                               |
| ----------------- | ------------------------------------------------------------------ |
| `/upload`         | 카메라 촬영, 이미지/문서 선택, 선택 파일 관리                      |
| `/ocr-result`     | 여러 파일의 결과 단계 이동, 건강검진·인바디 지표 수정, 재업로드 UI |
| `/total-analysis` | 건강 요약, 핵심 지표, 추천 이유/출처 Accordion과 상세 Bottom Sheet |
| `/start-move`     | 초기 분석 흐름 완료 후 식단·운동·홈으로 이동                       |

파일 선택 자체는 기기 API와 연결되어 있지만, 업로드 이후 OCR/KIE와 종합 분석 결과는 현재 mock 데이터로 생성됩니다.

### 탭 화면

- **홈 (`/home`)**: 건강 점수와 주간 진행 상황을 표시합니다. 현재 표시 데이터는 mock이며, 홈 진입 시 활성 채팅방과 메시지를 백그라운드에서 미리 조회합니다.
- **식단 (`/diet`)**: 날짜 이동, 영양 목표, 식사 카드 상태(`recommended`, `eaten`, `modified`, `skipped`), 냉장고 재료, 직접 식사 기록과 사진을 로컬 상태로 관리합니다.
- **운동 (`/exercise`)**: 운동 루틴의 미생성·준비·완료 상태를 표시하고 조건 입력 화면으로 연결합니다.
- **마이 (`/my`)**: 현재는 자리 표시자 화면입니다.

### 운동 추천 흐름

- `/exercise/condition`: 운동 가능 시간, 장소, 장비, 현재 컨디션과 불편 부위를 입력합니다.
- `/exercise/summary`: 조건 요약, 추천 이유와 운동 목록을 표시합니다.
- 운동 상태는 `ExerciseRoutineContext`에서 관리하며 현재 루틴 생성 결과는 `mockExerciseRoutine`을 사용합니다.

### AI 챗봇

홈 화면의 드래그 가능한 AI 버튼으로 `ChatPopup`을 엽니다. 활성 채팅방 조회, 채팅방 생성, 메시지 조회·전송을 백엔드 API와 연동하며 다음 동작을 포함합니다.

- 홈 진입 시 활성 채팅과 메시지 prefetch
- 팝업 재진입 시 메모리 캐시 즉시 표시 및 백그라운드 동기화
- optimistic message 표시
- `message_id` 기준 merge/dedupe
- 클라이언트 메시지 UUID를 사용한 전송 재시도

## 인증 및 API 연동 구조

### Supabase Auth

`src/lib/supabase.ts`의 `getSupabaseClient()`가 Supabase client를 singleton으로 생성합니다.

- Web은 Supabase 기본 저장소를 사용합니다.
- Native는 AsyncStorage에 세션을 저장합니다.
- 세션 자동 갱신과 영속화가 활성화되어 있습니다.
- 이메일 로그인은 `signInWithPassword`, 회원가입은 `signUp`을 사용합니다.
- 이메일 인증은 `verifyOtp`와 `resend`를 사용합니다.
- Google·Kakao 로그인은 `signInWithOAuth`를 사용하며 `auth/callback`에서 세션을 확정합니다.

OAuth를 사용하려면 Supabase Dashboard에서 각 provider와 앱의 callback URL을 별도로 설정해야 합니다. 앱 scheme은 `autofit`입니다.

### 백엔드 API

`src/api/client.ts`의 `apiRequest()`가 현재 Supabase session의 `access_token`을 읽어 모든 요청에 아래 헤더를 추가합니다.

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

현재 API base URL은 환경 변수가 아니라 `src/api/client.ts`의 `API_BASE_URL`에 개발 서버 주소로 정의되어 있습니다.

온보딩에서 사용하는 endpoint:

- `PATCH /api/profile`
- `GET /api/allergies`
- `PUT /api/allergies`
- `PUT /api/exercise/preferences`
- `POST /api/onboarding/complete`

챗봇에서 사용하는 endpoint:

- `GET /api/chats?status=active`
- `POST /api/chats`
- `GET /api/chats/{chat_id}/messages`
- `POST /api/chats/{chat_id}/messages`
- `PATCH /api/chats/{chat_id}`

## 설치 및 실행

### 준비 사항

- Node.js와 npm
- Android 실행 시 Android Studio/에뮬레이터 또는 Expo 실행이 가능한 실제 기기
- iOS 실행 시 macOS의 iOS Simulator 또는 Expo 실행이 가능한 실제 기기
- Supabase 프로젝트 및 아래 환경 변수

### 설치

```bash
git clone <repository-url>
cd Auto-Fit/frontend
npm ci
```

### 환경 변수 설정

`frontend/.env.example`을 복사해 `frontend/.env`를 만들고 본인의 Supabase 프로젝트 값을 입력합니다.

```env
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-project-url>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

주의 사항:

- `.env`에는 실제 프로젝트 값을 입력하되 Git에 커밋하지 마세요.
- Supabase Service Role Key는 클라이언트 앱에 넣지 마세요.
- Google·Kakao OAuth를 테스트하려면 Supabase provider 설정과 redirect URL 등록도 필요합니다.
- 환경 변수를 변경한 뒤에는 Expo 개발 서버를 다시 시작하세요.

### 개발 서버 실행

모든 명령은 `frontend` 디렉터리에서 실행합니다.

```bash
# Expo 개발 서버
npm run start

# Android
npm run android

# iOS
npm run ios

# Web
npm run web
```

## 주요 개발 명령어

| 명령어                 | 설명                                  |
| ---------------------- | ------------------------------------- |
| `npm run start`        | Expo 개발 서버 시작                   |
| `npm run android`      | Android 대상으로 Expo 실행            |
| `npm run ios`          | iOS 대상으로 Expo 실행                |
| `npm run web`          | Web 개발 서버 실행                    |
| `npm run typecheck`    | TypeScript 타입 검사 (`tsc --noEmit`) |
| `npm run lint`         | Expo ESLint 검사                      |
| `npm run format`       | Prettier로 전체 파일 포맷팅           |
| `npm run format:check` | 파일 변경 없이 Prettier 형식 검사     |

EAS 빌드 설정은 `frontend/eas.json`의 `development`, `preview`, `production` 프로필에 정의되어 있습니다.
