#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/android-widget/rn-app"

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
./gradlew --no-daemon :app:assembleRelease

APK_PATH="$APP_DIR/android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "React Native APK was not created: $APK_PATH" >&2
  exit 1
fi

echo "APK created: $APK_PATH"
