# 용정시간표 교사용 Android 앱

교사 주간 시간표 화면은 React Native로 구현합니다. Android 홈 화면 위젯은 `AppWidgetProvider`와 `RemoteViews`를 사용하며 React Native 앱과 설정을 공유합니다.

## 빌드

JDK 21, Android SDK, Node.js 22.11 이상이 필요합니다. 의존성이 없으면 빌드 스크립트가 `npm ci`를 실행합니다.

```sh
./android-widget/build-apk.sh
```

APK는 JS 번들을 포함한 `android-widget/rn-app/android/app/build/outputs/apk/release/app-release.apk`에 생성됩니다. 로컬 `android-widget/debug.keystore`로 서명하며, 스토어 배포 서명용은 아닙니다. Android 홈 화면 위젯은 2×1 크기까지 줄일 수 있습니다.

## 구글 플레이 배포

구글 플레이에는 AAB를 업로드 키로 서명해 올립니다. 업로드 키는 저장소에 커밋하지 않습니다. 직접 배포 APK는 기존 설치본이 업데이트되도록 계속 debug 키로 서명합니다.

1. 업로드 키를 한 번만 만듭니다. 비밀번호는 직접 정하고 안전한 곳에 보관합니다.

   ```sh
   keytool -genkeypair -v -storetype PKCS12 -keystore ~/.android-keys/yj-upload.jks -alias yj-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

2. `~/.gradle/gradle.properties`에 아래 값을 추가합니다.

   ```properties
   YJ_UPLOAD_STORE_FILE=/Users/<사용자>/.android-keys/yj-upload.jks
   YJ_UPLOAD_STORE_PASSWORD=<키 저장소 비밀번호>
   YJ_UPLOAD_KEY_ALIAS=yj-upload
   YJ_UPLOAD_KEY_PASSWORD=<키 비밀번호>
   ```

3. AAB를 빌드합니다. 결과물은 `android-widget/rn-app/android/app/build/outputs/bundle/release/app-release.aab`입니다.

   ```sh
   ./android-widget/build-aab.sh
   ```

4. Play Console에서 Play 앱 서명을 사용하고 AAB를 업로드합니다. 업로드할 때마다 `android/app/build.gradle`의 `versionCode`를 올립니다.

개인정보처리방침 URL은 `https://schedule.yjms.kr/privacy`를 사용합니다. 직접 설치한 APK와 플레이 버전은 서명이 달라 서로 업데이트되지 않으므로, 기존 사용자는 한 번 삭제 후 플레이에서 설치해야 합니다.
