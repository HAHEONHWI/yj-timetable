# 용정 시간표 Design System

## 1. Atmosphere & Identity

학교 운영 화면답게 빠르게 읽히는 어두운 정보 패널. 청색은 행동, 청록은 행사·성공, 황토색은 교과 변경, 적색은 신설·위험을 뜻한다. 시그니처는 5px 모서리와 얇은 경계선으로 구분한 밀도 높은 시간표 격자다.

## 2. Color

| 역할 | CSS token | 값 | 용도 |
|---|---|---|---|
| 배경 | `--bg` | `#16171b` | 문서 배경 |
| 깊은 배경 | `--bg-deep` | `#101115` | 슬라이드쇼·몰입 화면 |
| 기본 패널 | `--panel` | `#1d1e23` | 페이지, 폼 영역 |
| 강조 패널 | `--panel-strong` | `#25262c` | 높은 정보 밀도 영역 |
| 기본 글자 | `--ink` | `#f2f2f2` | 제목, 본문 |
| 보조 글자 | `--muted` | `#9ea0a8` | 설명, 메타데이터 |
| 경계선 | `--line` | `#303137` | 카드, 입력, 구분선 |
| 행동 | `--blue` | `#5b93cf` | 주 버튼, 선택 상태 |
| 행동 hover | `--blue-dark` | `#3f76b0` | 주 버튼 hover |
| 학생 호출 배경 | `--student-call-backdrop`, `--student-call-panel` | `rgba(10, 18, 34, 0.96)`, `#1b2a4a` | 전체 화면 호출 배경과 카드 |
| 학생 호출 글자 | `--student-call-ink`, `--student-call-muted`, `--student-call-detail` | `#ffffff`, `#b9d7f5`, `#dbeafb` | 이름·학급·추가 안내 |
| 성공 | `--green` | `#4b9779` | 성공 상태 |
| 위험 | `--danger` | `#c06565` | 폐기, 오류 |
| 변경 배경/글자 | `--change-bg`, `--change-text` | `rgba(194, 145, 63, 0.13)`, `#ddb46b` | 교과 변경 |
| 신규 변경 배경/글자 | `--new-change-bg`, `--new-change-text` | `rgba(192, 101, 101, 0.13)`, `#de9595` | 신규 수업 |
| 행사 배경/글자 | `--event-bg`, `--event-text` | `rgba(75, 151, 121, 0.2)`, `#9bd0b7` | 행사, 즉시 반영, 발급 성공 |

라이트 모드는 같은 token 이름을 `html[data-theme="light"]`에서 재정의한다. 새 의미색이 필요하면 먼저 이 표를 확장한다.

## 3. Typography

- 기본: `Pretendard, Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 코드: 브라우저 기본 monospace
- H1: `clamp(28px, 4vw, 42px)`, H2: `24px`, H3: `18px`
- 본문: `16px`, 보조: `14px`, 메타: `12px` 또는 `13px`
- 라벨·버튼은 정보 밀도에 따라 `400`~`600`, 시간표 핵심 데이터는 `600` 이상을 사용한다.
- 긴 한글 문장은 `line-height: 1.5` 이상, API key와 코드는 `overflow-wrap: anywhere`를 적용한다.

## 4. Spacing & Layout

- 실행 spacing token: `--space-2`, `--space-4`, `--space-5`, `--space-6`, `--space-8`, `--space-10`, `--space-11`, `--space-12`, `--space-14`, `--space-16`, `--space-18`, `--space-20`, `--space-24`, `--space-26`, `--space-28`, `--space-32`, `--space-48`
- 실행 type token: `--text-12`, `--text-13`, `--text-14`, `--text-15`, `--text-16`, `--text-18`, `--text-24`, `--display-1`
- control token: `--control-compact: 36px`, `--control-touch: 44px`
- 본문 token: `--content-max: 1180px`, `--page-gutter: 16px`
- 배경화면 desktop은 `--wallpaper-tools-width` 도구 column과 유연한 preview column을 사용하며 1024px 이하에서 한 열로 쌓는다.
- breakpoint: 모바일 시간표 `720px`, 단일 열 전환 `1024px`, 소형 화면 보강 `480px`
- radius: `--radius-sm: 3px`, `--radius-md: 5px`, `--radius-lg: 6px`; 상태 pill은 `999px`, 휴대폰 preview shell은 `36px`
- 데스크톱 다열 grid는 `minmax()`를 사용하고 1024px 이하에서 1열로 바꾼다.

## 5. Components

### Page Panel

- 구조: `.page`, `.login-panel`, `.admin-workspace`
- 상태: 기본, 숨김(`.is-hidden`)
- 간격: 16~28px responsive padding
- 접근성: 제목 계층을 유지하며 숨김 상태는 DOM 표시에서도 제외한다.

### Field

- 구조: `.field > label + input|select|textarea`
- 상태: 기본, focus, disabled, inline message
- 간격: 5px stack, 입력 최소 높이 36px
- 접근성: placeholder를 label로 대신하지 않고 모든 입력에 연결된 label을 둔다.

### Buttons

- 종류: `.primary-button`, `.ghost-button`, `.danger-button`, `.text-button`
- 상태: 기본, hover, focus-visible, disabled, loading(disabled + 진행 문구)
- 크기: compact 버튼 최소 높이 36px, 테마·슬라이드 직접 조작 hit area는 44×44px 이상
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

### Student Call

- 관리자 폼은 기존 `Field`, `Form Panel`, `primary-button`을 재사용한다.
- 전자칠판 호출은 전체 화면의 깊은 청색 overlay, 큰 학생 이름, 흰색 안내문으로 즉시 구분한다.
- 호출 닫기 버튼은 최소 44×44px이며 `Escape`와 버튼 클릭을 모두 지원한다.
- 학급·학생 이름·호출 장소는 한국어 의미구가 분리되지 않도록 `word-break: keep-all`을 적용한다.

### Academic Calendar

- 구조: `.academic-calendar` 안에 월 이동 control, 7열 요일 머리글, 6주 날짜 grid를 둔다.
- 데이터: 학생 조회는 선택 학급 `events`, 교사 조회는 전체 `events`만 표시하며 시간표·교과 변경은 섞지 않는다.
- 상태: 현재 달 밖 날짜는 약하게, 오늘은 `--shadow-today`, 일정은 행사 token으로 구분한다.
- 반응형: 720px 이하에서도 7열을 유지하며 날짜칸은 일정 건수만 표시한다. 달력 아래 목록에서 전체 일정명과 대상을 제공해 CJK 문구 잘림과 가로 overflow를 막는다.
- 접근성: 월 이동은 실제 button, grid에는 월·일정 수 label, 날짜 cell에는 날짜와 일정 수 label을 제공한다.

## 6. Motion & Interaction

- 기본 화면은 정적이다. 상태 전환은 즉시 표시한다.
- hover는 기존 색 또는 opacity만 바꾸며 기능 의미 없는 장식 애니메이션을 추가하지 않는다.
- focus-visible은 2px 청색 outline과 2px offset을 유지한다.
- 전체화면·modal처럼 기존 motion이 있는 곳은 `transform`, `opacity` 중심으로 사용한다.

## 7. Depth & Surface

혼합 전략. 일반 페이지와 폼은 1px 경계선과 tonal shift로 분리한다. 시간표 행사, 전역 상태, modal처럼 겹침 관계가 필요한 요소만 `--shadow-*` token을 사용한다. 새 API 화면은 일반 페이지 깊이를 따른다.

## 8. Accessibility Constraints & Accepted Debt

- 목표: WCAG 2.2 AA, 키보드 전체 사용, 명시적 label, 읽을 수 있는 오류·성공 문구.
- 모바일 375px에서 주요 내용의 가로 스크롤을 허용하지 않는다. 긴 API 코드 블록 내부만 가로 또는 단어 단위 줄바꿈을 허용한다.
- 한국어 안내 문장은 음절 중간에서 끊지 않도록 `word-break: keep-all`을 기본으로 한다.
- 짧은 의미구가 분리되면 `.keep-together`로 묶되 390px에서 가로 overflow가 없어야 한다.
- 인증번호 입력은 숫자 키보드와 `autocomplete="one-time-code"`를 제공한다.
- accepted debt: 기존 전체 CSS에는 문서화 전 raw 색과 오래된 emoji UI가 남아 있다. 이번 기능에서는 늘리지 않으며 별도 리팩터링 승인 전 유지한다.
