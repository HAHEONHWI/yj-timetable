#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/android-board/app"
BUILD_DIR="$ROOT_DIR/android-board/build"
OUT_DIR="$ROOT_DIR/android-board/output"
SDK_DIR="${ANDROID_HOME:-$ROOT_DIR/.android-sdk}"
PLATFORM_VERSION="${ANDROID_PLATFORM_VERSION:-35}"
BUILD_TOOLS_VERSION="${ANDROID_BUILD_TOOLS_VERSION:-35.0.0}"
PLATFORM_JAR="$SDK_DIR/platforms/android-$PLATFORM_VERSION/android.jar"
BUILD_TOOLS="$SDK_DIR/build-tools/$BUILD_TOOLS_VERSION"

if [[ ! -f "$PLATFORM_JAR" || ! -x "$BUILD_TOOLS/aapt2" || ! -x "$BUILD_TOOLS/d8" || ! -x "$BUILD_TOOLS/apksigner" ]]; then
  echo "Android SDK build tools are missing."
  echo "Expected SDK at: $SDK_DIR"
  echo "Install platforms;android-$PLATFORM_VERSION and build-tools;$BUILD_TOOLS_VERSION, then rerun."
  exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/compiled-res" "$BUILD_DIR/dex" "$OUT_DIR"

"$BUILD_TOOLS/aapt2" compile --dir "$APP_DIR/src/main/res" -o "$BUILD_DIR/compiled-res"

"$BUILD_TOOLS/aapt2" link \
  -I "$PLATFORM_JAR" \
  --manifest "$APP_DIR/src/main/AndroidManifest.xml" \
  -o "$BUILD_DIR/base.unsigned.apk" \
  --java "$BUILD_DIR/generated" \
  "$BUILD_DIR/compiled-res"/*.flat

javac \
  -source 1.8 \
  -target 1.8 \
  -bootclasspath "$PLATFORM_JAR" \
  -classpath "$BUILD_DIR/generated" \
  -d "$BUILD_DIR/classes" \
  "$APP_DIR/src/main/java/kr/yjms/timetable/board/MainActivity.java" \
  "$BUILD_DIR/generated/kr/yjms/timetable/board/R.java"

CLASS_FILES=$(find "$BUILD_DIR/classes" -name "*.class")

"$BUILD_TOOLS/d8" \
  --lib "$PLATFORM_JAR" \
  --output "$BUILD_DIR/dex" \
  $CLASS_FILES

cp "$BUILD_DIR/base.unsigned.apk" "$BUILD_DIR/base.dex.apk"
cd "$BUILD_DIR/dex"
zip -q "$BUILD_DIR/base.dex.apk" classes.dex
cd "$ROOT_DIR"

KEYSTORE="$ROOT_DIR/android-board/debug.keystore"
if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair \
    -keystore "$KEYSTORE" \
    -storepass android \
    -keypass android \
    -alias androiddebugkey \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=YJ Timetable Board, OU=23, O=Ha Heonhwi, L=Cheongju, S=Chungbuk, C=KR"
fi

"$BUILD_TOOLS/zipalign" -f 4 "$BUILD_DIR/base.dex.apk" "$BUILD_DIR/base.aligned.apk"

"$BUILD_TOOLS/apksigner" sign \
  --ks "$KEYSTORE" \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "$OUT_DIR/yj-timetable-board.apk" \
  "$BUILD_DIR/base.aligned.apk"

"$BUILD_TOOLS/apksigner" verify "$OUT_DIR/yj-timetable-board.apk"
echo "APK created: $OUT_DIR/yj-timetable-board.apk"
