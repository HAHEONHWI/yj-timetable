# 용정 시간표 서비스

용정중학교 전자 시간표 서비스입니다. 조회 화면, 슬라이드쇼, 관리자 편집 화면을 제공하는 정적 웹앱이며 별도 빌드 과정 없이 `index.html`로 실행됩니다.

## 주요 기능

- 이번 주와 다음 주의 월-금 시간표 조회
- 학급별 또는 전체 학급 시간표 표시
- 시간표와 안내사항을 자동 전환하는 슬라이드쇼
- 관리자 비밀번호 로그인
- 학급, 요일, 교시별 기본 시간표 편집
- 특정 요일에 반복 적용되는 기본 병합 칸 관리
- 주말 날짜별 특별시간표 저장
- 날짜, 학급, 교시 단위 단일교과 변경
- 날짜와 교시 구간 단위 행사 등록
- 슬라이드쇼 안내사항과 전환/새로고침 간격 관리

## 실행 방식

이 프로젝트는 서버 렌더링이나 번들러 없이 동작합니다.

- `index.html`: 화면 구조와 스크립트 로드
- `styles.css`: 전체 UI 스타일
- `src/app.js`: 화면 라우팅, 렌더링, 관리자 입력 처리
- `src/storage.js`: localStorage, Supabase 읽기/저장, realtime 동기화
- `src/supabase-config.js`: 브라우저에서 사용할 Supabase URL과 publishable/anon key

Supabase 설정이 없으면 브라우저 localStorage만 사용합니다. Supabase 설정이 있으면 `public.app_state` 테이블의 `id = 'main'` 행을 원격 상태로 사용하고, 변경 사항을 realtime으로 동기화합니다.

## 로컬 실행

1. 저장소를 준비합니다.
2. 브라우저에서 `index.html`을 엽니다.
3. 처음 실행하면 기본 시간표 상태가 localStorage에 생성됩니다.

Supabase를 연결하지 않은 로컬 모드의 관리자 비밀번호 기본값은 `1234`입니다.

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 아래 마이그레이션을 실행합니다.

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

4. Edge Function Secret을 설정합니다.

```bash
npx supabase secrets set ADMIN_PASSWORD=YOUR_ADMIN_PASSWORD --project-ref YOUR_PROJECT_REF
```

5. Edge Functions를 배포합니다.

```bash
npx supabase functions deploy admin-login --project-ref YOUR_PROJECT_REF
npx supabase functions deploy save-state --project-ref YOUR_PROJECT_REF
```

관리자 로그인과 저장은 Edge Function에서 처리합니다. 브라우저는 비밀번호를 직접 검증하지 않지만, 로그인한 탭 세션 동안 저장 요청에 사용할 비밀번호를 `sessionStorage`에 보관합니다.

## 보안 주의

`src/supabase-config.js`의 Supabase URL과 publishable/anon key는 브라우저에서 사용하는 공개 값입니다. 이 값은 공개될 수 있다는 전제로 RLS를 설정해야 합니다.

아래 값은 절대 Git에 커밋하지 마세요.

- `ADMIN_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY`
- JWT secret
- 데이터베이스 비밀번호
- `.env`, `.env.*`, `supabase/.env`, `supabase/.env.*`
- `supabase/.temp/` 같은 Supabase CLI 로컬 상태 파일

현재 RLS 설정은 `app_state` 읽기만 public으로 허용하고, anon/authenticated 사용자의 insert/update/delete 권한은 제거합니다. 원격 저장은 service role key를 가진 `save-state` Edge Function만 수행합니다.

## 데이터 구조

앱 상태는 `public.app_state` 테이블의 JSON 문서 하나로 저장됩니다. 주요 필드는 아래와 같습니다.

- `base`: 학급별 기본 시간표
- `baseMerges`: 요일별 반복 병합 정보
- `specialSchedules`: 주말 날짜별 특별시간표
- `changes`: 단일교과 변경 내역
- `events`: 행사 일정
- `notices`: 슬라이드쇼 안내 페이지
- `slideshow`: 전환 및 새로고침 설정

## 운영 메모

- 지난 단일교과 변경과 행사는 관리자 로그인 시 이번 주 월요일 이전 데이터를 자동 정리합니다.
- 특별시간표는 현재 토요일/일요일 날짜만 저장할 수 있습니다.
- 슬라이드쇼는 설정된 간격마다 화면을 전환하고, 별도 새로고침 간격마다 원격 상태를 다시 읽습니다.
- `supabase/functions/`와 `supabase/migrations/`는 배포와 DB 재현에 필요한 코드이므로 Git에 포함해야 합니다.
