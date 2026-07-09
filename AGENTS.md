# AGENTS.md

이 문서는 AI 에이전트가 `yj-timetable` 저장소를 수정할 때 따라야 하는 프로젝트 규칙입니다.

## 프로젝트 개요

용정 시간표 서비스는 학교 시간표를 웹, 전자칠판, 슬라이드쇼, Windows 위젯, Android 앱/위젯, iOS 배경화면 자동화로 제공하는 멀티플랫폼 시간표 프로젝트입니다.

- 운영 도메인: `https://schedule.yjms.kr`
- 정적 웹: `index.html`, `styles.css`, `src/`
- Supabase: `supabase/migrations/`, `supabase/functions/`
- Netlify Function: `netlify/functions/wallpaper.js`
- Windows 위젯: `widget/`, `dist/`, `Widget-Win/`
- Android 전자칠판 앱: `android-board/`
- Android 홈 화면 위젯: `android-widget/`
- 다운로드 산출물: `downloads/`

## 작업 원칙

- 기존 사용자 변경을 되돌리지 않는다.
- 작업 전 `git status --short --branch`로 dirty tree를 확인한다.
- Android 빌드 산출물, APK, `.class`, `.idsig`, keystore 변경은 요청받은 작업이 아니면 커밋하지 않는다.
- `src/supabase-config.js`의 공개 anon key는 브라우저용 공개 키다. service role key, DB 비밀번호, 실제 운영 비밀번호는 절대 커밋하지 않는다.
- 관리자/Auth/DB 저장 로직을 바꿀 때는 클라이언트 UI만 숨기지 말고 Supabase Edge Function에서도 권한을 검증한다.
- 사용자 요청이 UI 변경이면 데스크톱/모바일/전자칠판 화면에서 글자 겹침과 숨김 상태를 우선 확인한다.
- 배포 가능한 변경은 GitHub push와 Netlify production deploy까지 진행한다. 단, 작업트리에 무관한 변경이 있으면 해당 파일은 제외한다.

## 커밋 메시지 규칙

커밋 메시지는 아래 형식을 사용한다.

```text
type: 변경 내용
```

콜론 앞에는 공백을 넣지 않는다.

사용 가능한 타입:

```text
feat: 로그인 기능 구현
fix: 비밀번호 검증 오류 수정
docs: README 업데이트
style: 코드 포맷팅 수정 (기능 변경 없음)
refactor: 유저 서비스 로직 리팩토링
chore: 패키지 업데이트
```

기준:

- `feat`: 새 기능, 새 화면, 새 API, 새 권한 추가
- `fix`: 실제 동작 오류, 권한 오류, 배포 오류, UI 표시 오류 수정
- `docs`: README, AGENTS, 사용법, 정책 문서 수정
- `style`: 포맷팅, 공백, CSS 정리 등 기능 변경 없는 변경
- `refactor`: 기능은 유지하고 구조만 개선
- `chore`: 패키지, 빌드 설정, 산출물 정리, 자동화 보조 작업

예시:

```text
feat: Supabase Auth 관리자 로그인 추가
fix: 다운로드 개발 모드 노출 범위 조정
docs: AGENTS 작업 규칙 업데이트
style: 관리자 폼 간격 정리
refactor: 시간표 렌더링 로직 분리
chore: Netlify 배포 스크립트 정리
```

## 검증 명령

웹 클라이언트 문법 확인:

```bash
node --check src/app.js
node --check src/storage.js
```

Netlify Function 문법 확인:

```bash
node --check netlify/functions/wallpaper.js
```

정적 서버 확인:

```bash
python3 -m http.server 8000
```

Netlify production 배포:

```bash
npx netlify deploy --prod
```

Supabase 마이그레이션 적용:

```bash
npx supabase link --project-ref jzcectvzwbfvbgiszjkt
npx supabase db push
```

Supabase Edge Function 배포:

```bash
npx supabase functions deploy save-state --project-ref jzcectvzwbfvbgiszjkt
```

## Supabase Auth 규칙

관리자 로그인은 username을 내부 이메일로 변환한다.

```text
admin -> admin@yjms.local
```

username 규칙:

```text
영문 소문자, 숫자, _, -
3~32자
정규식: /^[a-z0-9_-]{3,32}$/
```

관리자 권한은 `admin_profiles.role`로 구분한다.

```text
owner: 전체 권한
manager: 시간표/행사/안내사항 운영 권한
viewer: 조회 전용
```

`viewer`는 저장/삭제/강제 새로고침을 할 수 없어야 한다. 프론트 UI뿐 아니라 `save-state` Edge Function에서도 차단해야 한다.

감사 로그는 `audit_logs`에 저장한다.

필수 기록:

- `actor_id`
- `actor_username`
- `actor_name`
- `action`
- `target_type`
- `target_id`
- `before_data`
- `after_data`
- `success`
- `error_message`

## 라우팅 규칙

주요 경로:

```text
/              일반 시간표 조회
/board         전자칠판 전용 화면
/slide         자동 슬라이드쇼
/admin         관리자 콘솔
/download      다운로드 페이지
/privacy       개인정보처리방침
/wallpaper.svg iOS 배경화면 SVG
/wallpaper.png iOS/Android 위젯 PNG 또는 JSON
```

개발 모드:

```text
/?dev=1 -> 개발 전용 UI 표시
/?dev=0 -> 개발 전용 UI 숨김
```

다운로드 페이지 규칙:

- 일반/`dev=0`: 교사용 Windows 위젯, 전자칠판 APK 표시
- `dev=1`: 교사용 Windows 위젯, 전자칠판 APK, 모바일 위젯 APK 표시

## 배포 주의사항

- Netlify 배포 후 production URL과 unique deploy URL을 사용자에게 알려준다.
- Supabase DB/function 변경은 Netlify 배포와 별개다. DB push와 function deploy 성공 여부를 따로 보고한다.
- Netlify Function `?debug=true`는 `WALLPAPER_DEBUG_TOKEN`이 맞을 때만 debug 정보를 반환해야 한다.
- `@resvg/resvg-js`를 사용하는 배경화면 PNG 렌더링은 폰트 포함 여부를 항상 확인한다.

## Android/Windows 산출물 규칙

- Android 빌드 스크립트는 `android-board/build-apk.sh`, `android-widget/build-apk.sh`를 사용한다.
- APK 빌드 후 변경되는 `build/`, `.class`, `.idsig`, `debug.keystore`는 별도 요청 없으면 커밋하지 않는다.
- Windows 위젯은 `npm run dist:win`으로 빌드한다.
- Windows “알 수 없는 게시자” 경고는 코드 서명 인증서 없이는 제거할 수 없다.

## 응답 규칙

- 완료 후 변경 파일, 검증 결과, 배포 URL을 짧게 보고한다.
- 실패한 작업은 원인과 다음 명령을 명확히 남긴다.
- 사용자에게 보이는 명령 출력은 필요한 핵심만 요약한다.
