# 공용 개발 서버 배포

2026-09-08: Render Free용 설정 준비. 아직 서비스 생성·배포·공유 URL 발급을 완료하지 않았다.

## 구성

- FastAPI: Render Python 웹 서비스, Singapore, Free, Python 3.14.7(로컬 검증 버전).
- DB/Auth: 기존 Supabase. 별도 Render DB는 만들지 않는다.
- 모델: 팀원 개발 모델의 연결 규격 확인 후 연동한다. 이 서비스에 모델/GPU를 배포하지 않는다.
- Git branch: backend. repo root 기준 실행. 자동 배포는 꺼 두고 검증한 버전만 수동 배포한다.

## 생성 순서

1. Render 계정으로 로그인하고 Auto-Fit GitHub 저장소 접근을 연결한다.
2. 백엔드 코드와 render.yaml을 포함한 배포 커밋을 검토 후 GitHub backend 브랜치에 올린다.
   현재 로컬에 아직 커밋되지 않은 구현이 있으므로 원격 브랜치만 바로 배포하면 최신 API가 없을 수 있다.
3. Blueprint로 render.yaml을 선택하거나 Web Service를 다음 설정으로 만든다.
4. 서버 환경변수를 대시보드에 입력하고 최초 배포한다.
5. 발급된 HTTPS 주소로 /health, /docs, 인증된 데이터 요청을 확인한다.
6. 프론트 담당에게 API_BASE를 전달하고 허용 origin에서 CORS까지 검증한다.

| 설정 | 값 |
|---|---|
| Root Directory | 비워 둠(저장소 루트) |
| Language | Python 3 |
| Branch | backend |
| Build | pip install -r backend/requirements.txt |
| Start | uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT |
| Health Check | /health |
| Instance | Free |
| Auto Deploy | Off |

## 환경변수

- PYTHON_VERSION: 3.14.7.
- SUPABASE_URL: 선택한 테스트 DB 프로젝트 URL.
- SUPABASE_PUBLISHABLE_KEY: 같은 프로젝트 공개용 키.
- SUPABASE_SERVICE_ROLE_KEY: 같은 프로젝트 서버 전용 키. Git·프론트·문서에 값을 넣지 않는다.
- FRONTEND_ORIGIN: 기본 프론트 실행 주소. 초기 로컬 개발이면 http://localhost:3000. 공유 개발 API는 Expo Web http://localhost:8081도 명시적으로 허용한다. 운영 전환 시 로컬 개발 Origin 허용을 재검토한다.
  이것은 origin 비교이므로 팀원 각자의 localhost:3000 프론트에서도 동일하게 사용할 수 있다.
  다른 포트 또는 배포 도메인 추가는 현재 단일 origin 설정의 확장 작업이 필요하다.

.env 파일을 업로드하지 않는다. Render 환경변수에 개별 입력한다.
이 공유 서버에 연결한 Supabase의 데이터는 실제 변경될 수 있으므로 합성 테스트 계정을 사용한다.

## 비용과 제한

Free 서비스는 15분 유휴 후 중단되고 재시작에 약 1분 걸릴 수 있다.
월 사용량 한도가 있으며 결제수단이 등록된 경우 대역폭/빌드 초과 과금 가능성이 있다.
유료 전환은 별도 결정한다. Free는 개발 검증용이며 항상 켜진 서비스가 아니다.
파일시스템은 영구 저장소가 아니므로 업로드 파일과 기록을 서버 로컬 디스크에 보관하지 않는다.

## 배포 성공 판단

- /health 200, /docs 200 (health는 DB 연결까지 검사하지 않음).
- 토큰 없는 /api/chats는 401.
- 실제 로그인 토큰으로 채팅 생성·전송·조회·중복 재전송 검증.
- 팀원 프론트 주소에서 CORS 요청 검증.
- 아직 모델 연동·요청 횟수 제한·1개월 자동 삭제는 미구현임을 공유.

공식 문서: [FastAPI 배포](https://render.com/docs/deploy-fastapi),
[Blueprint](https://render.com/docs/blueprint-spec), [무료 서비스 제한](https://render.com/docs/free).
