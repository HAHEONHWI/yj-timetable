# 용정 시간표 Design System

## 1. Atmosphere & Identity

학교 운영 화면답게 빠르게 읽히는 어두운 정보 패널. 청색은 행동, 청록은 행사·성공, 주황은 위험을 뜻한다. 시그니처는 8px 모서리와 얇은 경계선으로 구분한 밀도 높은 시간표 격자다.

## 2. Color

| 역할 | CSS token | 값 | 용도 |
|---|---|---|---|
| 배경 | `--bg` | `#0d1117` | 문서 배경 |
| 기본 패널 | `--panel` | `#151b23` | 페이지, 폼 영역 |
| 강조 패널 | `--panel-strong` | `#1f2937` | 높은 정보 밀도 영역 |
| 기본 글자 | `--ink` | `#eef4ff` | 제목, 본문 |
| 보조 글자 | `--muted` | `#9aa8bd` | 설명, 메타데이터 |
| 경계선 | `--line` | `#2f3b4c` | 카드, 입력, 구분선 |
| 행동 | `--blue` | `#3b82f6` | 주 버튼, 선택 상태 |
| 행동 hover | `--blue-dark` | `#2563eb` | 주 버튼 hover |
| 성공 | `--green` | `#087f5b` | 성공 상태 |
| 위험 | `--danger` | `#fb923c` | 폐기, 오류 |
| 변경 배경/글자 | `--change-bg`, `--change-text` | `#050816`, `#fde68a` | 교과 변경 |
| 신규 변경 배경/글자 | `--new-change-bg`, `--new-change-text` | `#450a0a`, `#fecaca` | 신규 수업 |
| 행사 배경/글자 | `--event-bg`, `--event-text` | `#0f766e`, `#ecfeff` | 행사, 즉시 반영, 발급 성공 |

새 UI는 위 token과 기존 패널색 `#07111d`, `#0f1623`, `#101826`, `#0b1220`만 재사용한다. 새 의미색이 필요하면 먼저 이 표를 확장한다.

## 3. Typography

- 기본: `Inter, Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- 코드: 브라우저 기본 monospace
- H1: `clamp(28px, 4vw, 42px)`, H2: `24px`, H3: `18px`
- 본문: `16px`, 보조: `14px`, 메타: `12px` 또는 `13px`
- 라벨과 버튼은 `700` 이상, 데이터 제목은 `800` 이상을 사용한다.
- 긴 한글 문장은 `line-height: 1.5` 이상, API key와 코드는 `overflow-wrap: anywhere`를 적용한다.

## 4. Spacing & Layout

- 기본 단위: 4px
- 간격: 4, 8, 12, 14, 16, 18, 24, 28, 32, 48px
- 본문 최대폭: `1180px`, 좌우 최소 여백 `16px`
- 기본 breakpoint: `1024px`, 소형 화면 보강 `480px`
- 카드·입력·버튼 radius: `8px`; 상태 pill만 `999px`
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
- 간격: 8px stack, 입력 최소 높이 44px
- 접근성: placeholder를 label로 대신하지 않고 모든 입력에 연결된 label을 둔다.

### Buttons

- 종류: `.primary-button`, `.ghost-button`, `.danger-button`, `.text-button`
- 상태: 기본, hover, focus-visible, disabled, loading(disabled + 진행 문구)
- 크기: 최소 높이 42px, 좌우 14px
- 접근성: 실제 `button` 또는 목적지가 있는 `a`를 사용한다.

### Form Panel

- 구조: `.admin-account-form` 안에 `.form-grid`와 버튼
- 상태: 기본, loading, error, success
- 표면: `--line` 경계선, `#0b1220` 배경, 18px padding
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

## 6. Motion & Interaction

- 기본 화면은 정적이다. 상태 전환은 즉시 표시한다.
- hover는 기존 색 또는 opacity만 바꾸며 기능 의미 없는 장식 애니메이션을 추가하지 않는다.
- focus-visible은 3px 청색 outline과 2px offset을 유지한다.
- 전체화면·modal처럼 기존 motion이 있는 곳은 `transform`, `opacity` 중심으로 사용한다.

## 7. Depth & Surface

혼합 전략. 일반 페이지와 폼은 1px 경계선과 tonal shift로 분리한다. 시간표 행사, 전역 상태, modal처럼 겹침 관계가 필요한 요소만 기존 shadow를 사용한다. 새 API 화면은 일반 페이지 깊이를 따른다.

## 8. Accessibility Constraints & Accepted Debt

- 목표: WCAG 2.2 AA, 키보드 전체 사용, 명시적 label, 읽을 수 있는 오류·성공 문구.
- 모바일 375px에서 주요 내용의 가로 스크롤을 허용하지 않는다. 긴 API 코드 블록 내부만 가로 또는 단어 단위 줄바꿈을 허용한다.
- 인증번호 입력은 숫자 키보드와 `autocomplete="one-time-code"`를 제공한다.
- accepted debt: 기존 전체 CSS에는 문서화 전 raw 색과 오래된 emoji UI가 남아 있다. 이번 기능에서는 늘리지 않으며 별도 리팩터링 승인 전 유지한다.
