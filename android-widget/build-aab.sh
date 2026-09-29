#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/android-widget/rn-app"
GRADLE_PROPS="${GRADLE_USER_HOME:-$HOME/.gradle}/gradle.properties"

if [[ -z "${JAVA_HOME:-}" && -d "/opt/homebrew/opt/openjdk@21" ]]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@21"
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [[ -d "${HOME}/Library/Android/sdk" ]]; then
    export ANDROID_HOME="${HOME}/Library/Android/sdk"
  fi
fi

if ! grep -q '^YJ_UPLOAD_STORE_FILE=' "$GRADLE_PROPS" 2>/dev/null; then
  echo "구글 플레이 업로드 키 설정이 없습니다: $GRADLE_PROPS" >&2
  echo "android-widget/README.md의 '구글 플레이 배포' 절차를 먼저 진행하세요." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  (cd "$APP_DIR" && npm ci)
fi

cd "$APP_DIR/android"
./gradlew --no-daemon -PyjPlayRelease :app:bundleRelease

AAB_PATH="$APP_DIR/android/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB_PATH" ]]; then
  echo "AAB was not created: $AAB_PATH" >&2
  exit 1
fi

echo "AAB created: $AAB_PATH"
