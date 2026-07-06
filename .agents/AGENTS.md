# Yongjeong Timetable Service - Agent Rules & Project Guide

이 문서는 AI 에이전트가 이 프로젝트(`yj-timetable`)를 작업할 때 숙지해야 할 특별 behavioral 규칙과 빌드/배포 파이프라인 가이드를 기술합니다.

## 1. 커밋 메시지 규칙 (Commit Message Guidelines)
*   **언어:** 커밋 메시지는 반드시 **영어(English)**로 작성합니다.
*   **접두어(Semantic Prefixes):** 변경 사항의 성격에 따라 명확한 접두어를 사용합니다.
    *   `feat:` 새로운 기능 추가 (예: 서버사이드 PNG 렌더링 구현)
    *   `fix:` 버그 수정 (예: 폰트 매칭 오류 수정)
    *   `layout:` UI/CSS 레이아웃 조정 (예: 설정 폼과 주간표 나란히 배치)
    *   `refactor:` 코드 구조 개선 및 최적화
*   **길이:** 커밋 내용은 가급적 한 줄에 꽉 차게 구체적으로 서술합니다.

## 2. 빌드 및 Netlify 배포 규칙
*   이 서비스는 Netlify 서버리스 함수(Netlify Functions)와 정적 페이지로 배포됩니다.
*   **배포 스크립트 실행 순서:**
    1.  배포 디렉토리인 `/private/tmp/timetable-netlify-deploy`에 파일들을 수집하는 `prepare-netlify-deploy.sh` 스크립트를 먼저 실행해야 합니다.
    2.  이 과정은 `package.json`의 `deploy:netlify` 스크립트에 묶여 있으므로, 배포를 진행할 때는 항상 아래 명령어를 직접 실행하십시오:
        ```bash
        npm run deploy:netlify
        ```
*   **의존성 추가 시 주의사항:**
    *   네이티브 컴파일 모듈(예: `@resvg/resvg-js` 등 Rust/C++ 바인딩 패키지)을 추가하는 경우, 원격 Netlify Linux 환경과의 바이너리 호환성을 위해 `dependencies`에 해당 리눅스 바인딩 패키지(예: `@resvg/resvg-js-linux-x64-gnu`)를 강제로 선언해 주어야 합니다.
    *   플랫폼 불일치로 인한 로컬 `npm install` 실패를 막기 위해 로컬 의존성 갱신 시에는 반드시 `--force` 플래그를 사용하십시오:
        ```bash
        npm install --force
        ```

## 3. 배경화면 렌더링 엔진 & 에셋 번들링 규칙
*   **엔드포인트 구성:**
    *   `/wallpaper`: 배경화면 다운로드 및 단축어 설정을 지원하는 교사용 웹페이지 설정 폼.
    *   `/wallpaper.svg`: 시간표를 동적 SVG 코드로 리턴하는 API.
    *   `/wallpaper.png`: `resvg-js` 가상 렌더러를 사용해 SVG를 실시간 PNG 이미지로 래스터화하여 쏴주는 API.
*   **서버 폰트 번들링 (`netlify.toml`):**
    *   서버리스 함수(`wallpaper.js`)에서 한글 글자가 깨지거나 유실되는 것을 막기 위해 `NanumGothic-Bold.ttf` 폰트 에셋을 동봉하여 배포합니다.
    *   새로운 폰트나 리소스 에셋을 추가할 때는 반드시 `netlify.toml`의 `included_files`에 해당 경로를 추가하고, `scripts/prepare-netlify-deploy.sh`에도 복사 명령을 기입해 누락을 방지하십시오.
*   **서버사이드 폰트 매핑:**
    *   `resvg-js` 로딩 시 폰트 충돌을 막기 위해 `fontBuffers`에 `NanumGothic-Bold.ttf` 의 바이너리 버퍼를 주입하여 생성하고, SVG 코드 내 `font-family` 리스트의 최우선 순위로 `NanumGothic`을 선언해 매칭시킵니다.
