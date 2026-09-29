# React Native 교사용 Android 앱

이 앱은 용정시간표 저장소의 하위 프로젝트입니다. 저장소 루트의 `AGENTS.md`가 프로젝트 규칙의 원본이며, 이 문서와 함께 따릅니다.

## 구조

- `App.tsx`: React Native 교사 주간 시간표 화면
- `android/app/src/main/java/kr/yjms/timetable/widget/WidgetSettingsModule.java`: React Native와 Android 위젯 설정 공유
- `android/app/src/main/java/kr/yjms/timetable/widget/TimetableWidgetProvider.java`: Android 홈 화면 위젯
- Android 홈 화면 위젯은 네이티브 `AppWidgetProvider`로 제공하고 React Native 앱과 설정을 공유합니다.

## 명령

저장소 루트에서 설치 및 개발 서버 실행:

```sh
cd android-widget/rn-app
npm install
npm run android
```

교사용 APK 빌드:

```sh
./android-widget/build-apk.sh
```

빌드 산출물은 `android/app/build/`에 생성되며 커밋하지 않습니다. keystore, APK 및 기존 `android-widget/build/` 사용자 파일을 덮어쓰거나 삭제하지 않습니다.
