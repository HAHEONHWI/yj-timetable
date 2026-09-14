# 용정 시간표 Design System

## 1. Atmosphere & Identity

KRDS HTML Component Kit v1.1.0을 바탕으로 한 어두운 고대비 중심의 학교 운영 화면. 다크 화면을 기본으로 제공하고 사용자가 밝은 화면으로 전환할 수 있다. KRDS 표준 청색은 행동, 성공색은 행사, 경고색은 교과 변경, 위험색은 신설·삭제를 뜻한다. 굵은 정보 계층, 4px 기반 간격, 48px 조작 영역이 시그니처다.

## 2. Color

| 역할 | CSS token | 값 | 용도 |
|---|---|---|---|
| 배경 | `--bg` | KRDS gray 5 `#f4f5f6` | 문서 배경 |
| 깊은 배경 | `--bg-deep` | KRDS gray 10 `#e6e8ea` | 몰입 화면 보조 배경 |
| 기본 패널 | `--panel` | KRDS gray 0 `#ffffff` | 페이지, 폼 영역 |
| 강조 패널 | `--panel-strong` | KRDS secondary 5 `#eef2f7` | 표 머리글, 선택 영역 |
| 기본 글자 | `--ink` | KRDS gray 90 `#1e2124` | 제목, 본문 |
| 보조 글자 | `--muted` | KRDS gray 60 `#58616a` | 설명, 메타데이터 |
| 경계선 | `--line` | KRDS gray 20 `#cdd1d5` | 카드, 입력, 구분선 |
| 행동 | `--blue` | KRDS primary 50 `#256ef4` | 주 버튼, 선택 상태 |
| 행동 hover | `--blue-dark` | KRDS primary 60 `#0b50d0` | 주 버튼 hover |
| 성공 | `--green` | KRDS success 50 `#228738` | 성공 상태 |
| 위험 | `--danger` | KRDS danger 50 `#de3412` | 폐기, 오류 |
| 변경 배경/글자 | `--change-bg`, `--change-text` | KRDS warning 5 `#fff3db`, warning 70 `#614100` | 교과 변경 |
| 신규 변경 배경/글자 | `--new-change-bg`, `--new-change-text` | KRDS danger 5 `#fdefec`, danger 60 `#bd2c0f` | 신규 수업 |
| 행사 배경/글자 | `--event-bg`, `--event-text` | KRDS success 5 `#eaf6ec`, success 70 `#285d33` | 행사, 즉시 반영, 발급 성공 |

선명한 화면 모드는 같은 token 이름을 `html[data-theme="dark"]`에서 KRDS 고대비 팔레트로 재정의한다. 새 의미색이 필요하면 먼저 이 표를 확장한다.

## 3. Typography

- 기본: `"Pretendard GOV", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 코드: 브라우저 기본 monospace
- H1: `clamp(28px, 4vw, 42px)`, H2: `24px`, H3: `18px`
- 본문: `16px`, 보조: `14px`, 메타: `12px` 또는 `13px`
- 라벨·버튼은 정보 밀도에 따라 `400`~`600`, 시간표 핵심 데이터는 `600` 이상을 사용한다.
- 긴 한글 문장은 `line-height: 1.5` 이상, API key와 코드는 `overflow-wrap: anywhere`를 적용한다.

## 4. Spacing & Layout

- 실행 spacing token: `--space-2`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, `--space-11`, `--space-12`, `--space-14`, `--space-16`, `--space-18`, `--space-20`, `--space-24`, `--space-26`, `--space-28`, `--space-32`, `--space-48`
- 실행 type token: `--text-12`, `--text-13`, `--text-14`, `--text-15`, `--text-16`, `--text-18`, `--text-24`, `--display-1`
- KRDS override는 추가 named token(`--space-1`, `--space-3`, `--space-30`, `--space-34`, `--space-36`, `--space-40`, `--space-56`, `--space-58`, `--space-64`, `--space-72`, `--space-80`, `--text-10`, `--text-20`, `--text-26`, `--text-30`, `--text-36`)을 `styles-krds.css`에서 정의하고, 모든 신규 spacing/type 값을 해당 token으로 참조한다.
- control token: `--control-compact: 40px`, `--control-touch: 48px`
- 본문 token: `--content-max: 1280px`, `--page-gutter: clamp(16px, 3vw, 32px)`
- 배경화면 desktop은 `--wallpaper-tools-width` 도구 column과 유연한 preview column을 사용하며 1024px 이하에서 한 열로 쌓는다.
- breakpoint: 모바일 시간표 `720px`, 단일 열 전환 `1024px`, 소형 화면 보강 `480px`
- radius: KRDS number token에 맞춰 `--radius-sm: 4px`, `--radius-md: 6px`, `--radius-lg: 8px`; 상태 badge는 4px, 휴대폰 preview shell은 36px
- 데스크톱 다열 grid는 `minmax()`를 사용하고 1024px 이하에서 1열로 바꾼다.

## 5. Components

### Page Panel

- 구조: `.page`, `.login-panel`, `.admin-workspace`
- 상태: 기본, 숨김(`.is-hidden`)
- 간격: 16~28px responsive padding
- 접근성: 제목 계층을 유지하며 숨김 상태는 DOM 표시에서도 제외한다.

### KRDS Core Components

- 조회 화면은 `.krds-page-header`, `.krds-field`, `.krds-segmented`, `.krds-tabs`, `.krds-table`, `.krds-badge-group` 조합으로 페이지 헤더·필드·선택·탭·데이터 표·상태 배지를 구성한다.
- 컴포넌트는 기존 동적 렌더링 대상 DOM을 감싸며, 데이터와 이벤트 핸들러를 변경하지 않는다.

### Header

- `.topbar`는 desktop에서 80px 높이, tablet 이하에서 2행 구조로 전환한다.
- 현재 메뉴는 3px primary 하단선과 굵은 글자로 표시한다.
- 모바일 메뉴는 문서 전체가 아닌 nav 내부에서만 가로 스크롤한다.

### Footer Disclosure

- `.footer-disclosure`는 서비스 footer에서 KRDS 디자인 시스템 활용 사실을 고지하는 재사용 가능한 메타 컴포넌트다.

### Field

- 구조: `.field > label + input|select|textarea`
- 상태: 기본, focus, disabled, inline message
- 간격: 5px stack, 입력 최소 높이 36px
- 접근성: placeholder를 label로 대신하지 않고 모든 입력에 연결된 label을 둔다.

### Buttons

- 종류: `.primary-button`, `.ghost-button`, `.danger-button`, `.text-button`
- 상태: 기본, hover, focus-visible, disabled, loading(disabled + 진행 문구)
- 크기: 기본 버튼과 직접 조작 hit area는 48px 이상
- 접근성: 실제 `button` 또는 목적지가 있는 `a`를 사용한다.

### Toggle & Slide Indicator

- 테마·보기 방식·재생 토글은 현재 상태를 `aria-pressed`로 노출한다.
- 슬라이드 표시기는 기본 12×3px, 활성 28×3px 선을 사용하되 실제 버튼 hit area는 최소 44×44px로 둔다.
- 현재 슬라이드는 `aria-current="page"`, `aria-selected="true"`, `tabindex="0"`을 함께 사용한다.
- 비활성 슬라이드는 `tabindex="-1"`로 두고 명칭은 `슬라이드 N로 이동` 형식을 사용한다.
- 포커스된 표시기는 `ArrowLeft`, `ArrowRight`, `Home`, `End`로 이동하며 선택 후 새 활성 표시기에 포커스를 유지한다.

### Date Tabs

- 날짜 버튼은 `role="tab"`, `aria-selected`, roving `tabindex`를 사용한다.
- `ArrowLeft`, `ArrowRight`, `Home`, `End`로 날짜를 바꾸고 새 활성 tab에 포커스를 유지한다.

### Form Panel

- 구조: `.admin-account-form` 안에 `.form-grid`와 버튼
- 상태: 기본, loading, error, success
- 표면: `--line` 경계선, `--panel` 또는 `--panel-soft` 배경, 18px padding
- 반응형: 1024px 이하 한 열

### Result Panel

- 구조: `.api-key-result` 안에 제목, 1회 비밀값, 복사 버튼
- 상태: 숨김, 성공, 복사 완료
- 표면: 행사/성공 색상 사용
- 접근성: `aria-live="polite"`, 긴 key 자동 줄바꿈

### List Item

- 구조: `.list > .list-item`, 본문과 선택 행동
- 상태: 기본, active, disabled, empty, loading
- 반응형: 480px 이하에서 API 폐기 버튼을 전체 폭으로 쌓는다.

### Academic Calendar

- 구조: `.academic-calendar` 안에 월 이동 control, 7열 요일 머리글, 6주 날짜 grid를 둔다.
- 데이터: 수동 시간표 행사 `events`와 별도 `academic_events`의 NEIS 일정을 표시 단계에서 합친다. 학생 조회는 선택 학급·학년만, 교사 조회는 전체 일정을 표시하며 NEIS 일정은 교시 시간표를 덮어쓰지 않는다.
- 상태: 현재 달 밖 날짜는 약하게, 오늘은 `--shadow-today`, 일정은 행사 token으로 구분한다.
- 반응형: 720px 이하에서도 7열을 유지하며 날짜칸은 일정 건수만 표시한다. 달력 아래 목록에서 전체 일정명과 대상을 제공해 CJK 문구 잘림과 가로 overflow를 막는다.
- 접근성: 월 이동은 실제 button, grid에는 월·일정 수 label, 날짜 cell에는 날짜와 일정 수 label을 제공한다.

### Academic Calendar Admin

- 구조: 관리자 `학사일정` 탭에 같은 달력을 두고, 아래에 날짜·교시·일정명·학급·메모 입력 폼과 해당 월 목록을 쌓는다.
- 데이터: 조회 화면 달력과 같은 `events`를 편집한다. 별도 저장소를 만들지 않는다.
- 상태: 날짜칸은 button이라 클릭하면 그 날짜로 새 입력을 시작하고 선택 표시가 붙는다. 목록의 `수정`은 폼을 채우고 저장 버튼 문구를 바꾼다.
- 권한: `update_event` 권한이 없으면 달력칸·폼·목록 버튼을 모두 비활성화한다.

## 6. Motion & Interaction

- 기본 화면은 정적이다. 상호작용 상태는 160ms 색·경계·그림자 전환만 사용한다.
- hover는 기능 가능한 요소의 배경·경계로 조작 가능성을 알린다. press는 `translateY(1px)`로 입력을 확인한다.
- focus-visible은 3px KRDS primary outline과 2px offset을 유지한다.
- `prefers-reduced-motion: reduce`에서는 스크롤과 전환을 즉시 처리한다.
- 전체화면·modal처럼 기존 motion이 있는 곳은 `transform`, `opacity` 중심으로 사용한다.

## 7. Depth & Surface

KRDS tonal surface 전략. 일반 페이지는 gray 5 배경 위 white 표면과 1px gray 10 경계로 분리한다. 카드와 폼은 얕은 `--shadow-sm`, sticky header는 반투명 표면과 blur, modal만 `--shadow-lg`를 사용한다. 선명한 화면에서는 그림자보다 고대비 경계선을 우선한다.

## 8. Accessibility Constraints & Accepted Debt

- 목표: WCAG 2.2 AA, 키보드 전체 사용, 명시적 label, 읽을 수 있는 오류·성공 문구.
- 첫 포커스에서 `본문 바로가기` 링크를 제공하고 `main`으로 이동한다.
- 모바일 375px에서 주요 내용의 가로 스크롤을 허용하지 않는다. 긴 API 코드 블록 내부만 가로 또는 단어 단위 줄바꿈을 허용한다.
- 한국어 안내 문장은 음절 중간에서 끊지 않도록 `word-break: keep-all`을 기본으로 한다.
- 짧은 의미구가 분리되면 `.keep-together`로 묶되 390px에서 가로 overflow가 없어야 한다.
- 인증번호 입력은 숫자 키보드와 `autocomplete="one-time-code"`를 제공한다.
- accepted debt: 앱 기능과 배포 안정성을 위해 기존 `styles.css`를 유지하고 `styles-krds.css`에서 token과 주요 primitive를 계층적으로 재정의한다. 일부 상세 관리자 편집기의 오래된 raw 간격과 안내 문구 emoji는 후속 마크업 정리 대상으로 남는다.
