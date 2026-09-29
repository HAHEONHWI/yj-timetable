# 용정시간표 교사용 Android 앱

교사 주간 시간표 화면은 React Native로 구현합니다. Android 홈 화면 위젯은 `AppWidgetProvider`와 `RemoteViews`를 사용하며 React Native 앱과 설정을 공유합니다.

## 빌드

JDK 21, Android SDK, Node.js 22.11 이상이 필요합니다. 의존성이 없으면 빌드 스크립트가 `npm ci`를 실행합니다.

```sh
./android-widget/build-apk.sh
```

APK는 JS 번들을 포함한 `android-widget/rn-app/android/app/build/outputs/apk/release/app-release.apk`에 생성됩니다. 로컬 `android-widget/debug.keystore`로 서명하며, 스토어 배포 서명용은 아닙니다. 홈 화면 위젯 소스와 기존 교사 설정 화면은 `android-widget/rn-app/android/app/src/main/java/kr/yjms/timetable/widget/`에 있습니다.
