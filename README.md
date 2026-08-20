# 용정 시간표 서비스 (Yongjeong Timetable)

브라우저 기반 전자 시간표 프로젝트입니다. 일반 조회, 전자칠판용 `/board`, 자동 슬라이드쇼, 관리자 편집, Windows 데스크톱 위젯(Electron), Android WebView APK를 포함합니다.

운영 (예시): https://schedule.yjms.kr

## 주요 기능

- 이번 주 / 다음 주 시간표 조회 (월~금)
- 학급별 / 전체 학급 보기
- 전자칠판용 `/board` 화면(가로 고정)
- 자동 슬라이드쇼(시간표 ⇄ 공지 전환) 및 키보드 제어
- 관리자 비밀번호 기반 편집(Edge Function 사용)
- Supabase를 통한 원격 저장 및 Realtime 동기화
- Windows Electron 위젯, Android WebView APK 제공

## 구성 요소

- 웹 정적 파일: `index.html`, `styles.css`, `src/`
- Supabase: `supabase/functions/`, `supabase/migrations/`
- Windows 위젯: `widget/` (Electron)
- Android WebView: `android-board/` (빌드 스크립트 포함)

## 빠른 시작 (로컬)

Prerequisite: Node.js (개발용), Python(간단한 정적 서버), Netlify CLI(선택)

1) 정적 서버로 확인 (간단한 테스트)

```bash
python3 -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속. `/board` 확인은 Netlify Dev 권장:

```bash
npx netlify dev --dir=. --port 8888
# 접속: http://localhost:8888/board
```

2) Windows 위젯 실행

```bash
npm install
npm run start:widget
```

3) Android APK 빌드

```bash
./android-board/build-apk.sh
# 결과: android-board/output/yj-timetable-board.apk
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. 마이그레이션 적용:

```text
supabase/migrations/001_app_state.sql
supabase/migrations/004_production_rls.sql
supabase/migrations/005_enable_realtime.sql
```

3. `src/supabase-config.js`에 공개용 URL/anon key 설정:

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
};
```

4. 관리자 비밀번호(시크릿) 설정 및 Edge Functions 배포

```bash
npx supabase secrets set ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD --project-ref YOUR_PROJECT_REF
npx supabase functions deploy admin-login --project-ref YOUR_PROJECT_REF
npx supabase functions deploy save-state --project-ref YOUR_PROJECT_REF
```

주의: 공개 브라우저 키는 노출되므로 RLS(행 수준 보안)를 적절히 설정하세요.

## 읽기 전용 REST API

`dev` 관리자는 `/admin`의 `API key` 탭에서 사용처 이름, 분당 요청 한도, 만료일을 지정해 key를 발급하거나 폐기할 수 있습니다. 원본 key는 발급 직후 한 번만 표시되며 DB에는 SHA-256 hash만 저장됩니다.

```bash
curl -H "X-API-Key: yj_live_..." \
  "https://jzcectvzwbfvbgiszjkt.supabase.co/functions/v1/public-api/v1/timetable?date=2026-08-20&class=1-1"
```

조회 endpoint:

- `GET /v1/timetable?date=YYYY-MM-DD` — 전체 학급 시간표
- `GET /v1/timetable?date=YYYY-MM-DD&class=1-1` — 선택 학급 시간표
- `GET /v1/events?date=YYYY-MM-DD&class=1-1`
- `GET /v1/changes?date=YYYY-MM-DD&class=1-1`
- `GET /v1/notices`
- `GET /v1/classes`
- `GET /v1/openapi.json`

전체 학급을 한 번에 조회하면 `data`가 학급별 객체로 반환됩니다.

```json
{
  "data": {
    "1-1": [],
    "1-2": [],
    "2-1": [],
    "2-2": [],
    "3-1": [],
    "3-2": []
  }
}
```

`events`와 `changes`는 `date`와 `class`를 모두 넣어 선택한 학급의 항목만 조회합니다.

`POST`, `PUT`, `PATCH`, `DELETE`는 허용하지 않습니다. API 안내와 OpenAPI 문서는 key 없이 조회할 수 있고, 실제 데이터 조회에는 `X-API-Key`가 필요합니다.

## 배포

- Netlify(권장): 정적 파일을 배포합니다. 내부 스크립트로 불필요한 파일을 제외한 뒤 배포합니다.

```bash
npm run prepare:netlify
npm run deploy:netlify
```

## 주요 npm 스크립트

- `npm run start:widget` — Electron 으로 Windows 위젯 실행
- `npm run dist:win` — Windows 설치 파일(NSIS) 빌드
- `npm run prepare:netlify` — Netlify 배포 준비 스크립트
- `npm run deploy:netlify` — Netlify에 프로덕션 배포

## 파일 구조(요약)

- `index.html`, `styles.css` — 웹 클라이언트
- `src/app.js` — 렌더링/라우팅/관리자 UI
- `src/storage.js` — localStorage & Supabase 연동
- `src/supabase-config.js` — 공개 Supabase 설정
- `widget/` — Electron 위젯 소스
- `android-board/` — APK 빌드 스크립트
- `supabase/` — migrations, Edge Functions

## 데이터 모델 요약

앱 상태는 `public.app_state` JSON 문서로 관리됩니다. 주요 키:

- `base`, `baseMerges`, `specialSchedules`, `changes`, `events`, `notices`, `slideshow`

## 보안 및 운영 주의

- 절대로 저장소에 시크릿(ADMIN_PASSWORD, SERVICE_ROLE_KEY 등)을 커밋하지 마세요.
- 브라우저 anon key는 공개될 수 있으므로 RLS로 권한을 제한하세요.
- Android keystore, 서비스 키, 빌드 산출물은 `.gitignore`에 포함되어야 합니다.

## 기여 가이드

1. Issue 생성 또는 PR 제출
2. 변경 전 간단한 설명과 재현 방법 첨부
3. 테스트 및 로컬 빌드 확인

원하면 영어 README 번역이나 GitHub용 배지 추가도 도와드리겠습니다.

## 연락 / 저작권

제작자: 하헌휘

License: 별도 파일이 없으면 기본적으로 MIT 권장 — 원하시면 `LICENSE` 추가해 드립니다.

---

파일 업데이트: [README.md](README.md)
