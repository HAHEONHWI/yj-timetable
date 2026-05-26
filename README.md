# 용정 시간표 서비스

용정중학교 전자 시간표 서비스입니다. 일반 조회 화면, 전자칠판용 `/board` 화면, 자동 슬라이드쇼, 관리자 편집 화면, Windows 바탕화면 위젯, Android WebView APK를 포함합니다.

운영 주소: https://schedule.yjms.kr

## 주요 기능

- 이번 주와 다음 주의 월-금 시간표 조회
- 학급별 또는 전체 학급 시간표 표시
- 전자칠판용 `/board` 화면
- `/board`에서 학급 선택, 라이트/다크 모드, 선택값 로컬 저장
- 시간표와 안내사항을 자동 전환하는 슬라이드쇼
- 슬라이드쇼 키보드 조작: 왼쪽/오른쪽 화살표, 스페이스
- 관리자 비밀번호 로그인
- 학급, 요일, 교시별 기본 시간표 편집
- 특정 요일 반복 병합 칸 관리
- 주말 날짜별 특별시간표 저장
- 날짜, 학급, 교시 단위 단일교과 변경
- 날짜와 교시 구간 단위 행사 등록
- Supabase 저장 및 realtime 동기화

## 화면 구성

- `/`: 일반 시간표 조회, 슬라이드쇼, 관리자 화면
- `/board`: 전자칠판/Android APK용 주간 시간표 화면
- Windows 위젯: 오늘 하루 전체 학급 시간표 표시
- Android APK: `/board`를 WebView로 표시

Netlify에서 `/board`가 `index.html`로 열리도록 `_redirects`를 사용합니다.

```text
/board  /index.html  200
```

## 파일 구조

```text
index.html                  웹 화면 구조
styles.css                  웹/슬라이드쇼/board 스타일
src/app.js                  렌더링, 라우팅, 관리자 입력 처리
src/storage.js              localStorage, Supabase, realtime 처리
src/supabase-config.js      Supabase 공개 설정
assets/                     로고와 배너 이미지
widget/                     Windows Electron 위젯 소스
android-board/              Android WebView APK 소스와 빌드 스크립트
supabase/functions/         Supabase Edge Functions
supabase/migrations/        Supabase DB 마이그레이션
Widget-Win/                 Windows 설치 파일 배포용 폴더
```

## 로컬 실행

정적 웹앱이라 빌드 없이 실행할 수 있습니다.

```bash
python3 -m http.server 8000
```

접속:

```text
http://localhost:8000
```

`/board` 라우트까지 로컬에서 확인하려면 Netlify dev를 쓰는 편이 좋습니다.

```bash
npx netlify dev --dir=. --port 8888
```

접속:

```text
http://localhost:8888/board
```

Supabase 연결이 없으면 브라우저 `localStorage`만 사용합니다. 처음 접속하면 기본 시간표 상태가 로컬에 생성됩니다.

## Windows 위젯

Windows 위젯은 Electron 기반입니다.

실행:

```bash
npm install
npm run start:widget
```

설치 파일 빌드:

```bash
npm run dist:win
```

현재 설정:

- 앱 이름: `용정시간표-Widget`
- 설치 방식: NSIS 설치형
- 바탕화면 바로가기 생성
- 시작 메뉴 바로가기 생성
- 제작자: `하헌휘`

Windows Defender SmartScreen의 알 수 없는 게시자 경고는 코드 서명 인증서가 없으면 완전히 제거할 수 없습니다.

## Android APK

Android 앱은 네이티브 WebView 래퍼입니다. 앱 내부에서 `https://schedule.yjms.kr/board`를 표시합니다.

빌드:

```bash
./android-board/build-apk.sh
```

결과:

```text
android-board/output/yj-timetable-board.apk
```

현재 APK 설정:

- 패키지명: `kr.yjms.timetable.board`
- 앱 이름: `용정시간표 Board`
- 최소 Android: 5.0, API 21
- target SDK: 35
- 화면 방향: 가로 고정
- 앱 아이콘: `assets/logo.png` 기반

Android SDK가 없으면 `build-apk.sh` 실행 전에 Android command line tools, `platforms;android-35`, `build-tools;35.0.0` 설치가 필요합니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 마이그레이션을 실행합니다.

```text
supabase/migrations/001_app_state.sql
supabase/migrations/004_production_rls.sql
supabase/migrations/005_enable_realtime.sql
```

3. `src/supabase-config.js`에 프로젝트 URL과 publishable/anon key를 넣습니다.

```js
window.SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY",
};
```

4. Edge Function secret을 설정합니다.

```bash
npx supabase secrets set ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD --project-ref YOUR_PROJECT_REF
```

5. Edge Functions를 배포합니다.

```bash
npx supabase functions deploy admin-login --project-ref YOUR_PROJECT_REF
npx supabase functions deploy save-state --project-ref YOUR_PROJECT_REF
```

관리자 로그인과 저장은 Edge Function에서 처리합니다. 원격 저장은 service role key를 가진 `save-state` 함수만 수행합니다.

## Netlify 배포

프로덕션 배포:

```bash
npx netlify deploy --prod --dir=.
```

현재 작업에서는 웹 배포 시 불필요한 빌드 산출물 업로드를 피하기 위해 필요한 정적 파일만 임시 폴더에 모아 배포합니다.

필수 배포 파일:

```text
index.html
styles.css
_redirects
assets/logo.png
assets/home-banner.png
src/app.js
src/storage.js
src/supabase-config.js
```

## 데이터 구조

앱 상태는 `public.app_state` 테이블의 JSON 문서 하나로 저장됩니다.

- `base`: 학급별 기본 시간표
- `baseMerges`: 요일별 반복 병합 정보
- `specialSchedules`: 날짜별 특별시간표
- `changes`: 단일교과 변경 내역
- `events`: 행사 일정
- `notices`: 슬라이드쇼 안내 페이지
- `slideshow`: 전환 및 새로고침 설정

## 보안 주의

`src/supabase-config.js`의 Supabase URL과 publishable/anon key는 브라우저 공개 값입니다. 공개될 수 있다는 전제로 RLS를 설정해야 합니다.

Git에 커밋하지 말아야 할 값:

- `ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- JWT secret
- 데이터베이스 비밀번호
- `.env`, `.env.*`, `supabase/.env`, `supabase/.env.*`
- Android keystore
- 로컬 SDK와 빌드 산출물

현재 RLS 설정은 `app_state` 읽기만 public으로 허용하고, anon/authenticated 사용자의 insert/update/delete 권한은 제거합니다.

## 운영 메모

- 지난 단일교과 변경과 행사는 관리자 로그인 시 이번 주 월요일 이전 데이터를 자동 정리합니다.
- 특별시간표는 현재 토요일/일요일 날짜만 저장할 수 있습니다.
- `/board`의 학급 선택과 테마 선택은 기기별 `localStorage`에 저장됩니다.
- APK는 웹뷰 방식이므로 `/board` 웹 화면이 배포되면 앱에도 반영됩니다.
- Windows 위젯과 Android APK 빌드 산출물은 기본적으로 Git에 포함하지 않습니다.
