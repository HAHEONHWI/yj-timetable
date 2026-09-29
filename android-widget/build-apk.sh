#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/android-widget/rn-app"
# 사용법: build-apk.sh [teacher|student] (기본값 teacher)
AUDIENCE="${1:-teacher}"
if [[ "$AUDIENCE" != "teacher" && "$AUDIENCE" != "student" ]]; then
  echo "teacher 또는 student를 지정하세요: $AUDIENCE" >&2
  exit 1
fi
VARIANT="$(tr '[:lower:]' '[:upper:]' <<< "${AUDIENCE:0:1}")${AUDIENCE:1}Release"

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

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  (cd "$APP_DIR" && npm ci)
fi

cd "$APP_DIR/android"
./gradlew --no-daemon ":app:assemble${VARIANT}"

APK_PATH="$APP_DIR/android/app/build/outputs/apk/$AUDIENCE/release/app-$AUDIENCE-release.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "React Native APK was not created: $APK_PATH" >&2
  exit 1
fi

echo "APK created: $APK_PATH"
