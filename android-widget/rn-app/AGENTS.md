# React Native 교사용 Android 앱

이 앱은 용정시간표 저장소의 하위 프로젝트입니다. 저장소 루트의 `AGENTS.md`가 프로젝트 규칙의 원본이며, 이 문서와 함께 따릅니다.

## 구조

- `App.tsx`: 빌드 종류(교사용/학생용)에 따라 화면 선택
- `TeacherApp.tsx`: 교사용 화면, `StudentApp.tsx`: 학생용 화면, `src/shared.tsx`: 공통 타입·표·알림 설정 창
- 교사용/학생용은 `android/app/build.gradle`의 productFlavors(`teacher`, `student`)로 나뉜다.
- `android/app/src/main/java/kr/yjms/timetable/widget/WidgetSettingsModule.java`: React Native와 Android 위젯 설정 공유
- `android/app/src/main/java/kr/yjms/timetable/widget/TimetableWidgetProvider.java`: Android 홈 화면 위젯
- Android 홈 화면 위젯은 네이티브 `AppWidgetProvider`로 제공하고 React Native 앱과 설정을 공유합니다.
- `android/app/src/main/java/kr/yjms/timetable/widget/TeacherNotifications.java`: 교과 변경 알림(1시간마다 교사 시간표 비교)과 평일 오전 8시 일일 수업 알림. 서버 푸시 없이 기기에서 처리합니다.
- 교사 목록, 학급 시간표, 학사일정은 `netlify/functions/wallpaper.js`의 `format=teachers`, `format=classes`, `format=academic` 응답을 씁니다.

## 명령

저장소 루트에서 설치 및 개발 서버 실행:

```sh
cd android-widget/rn-app
npm install
npm run android
```

교사용 APK 빌드:

```sh
./android-widget/build-apk.sh teacher   # 또는 student
```

구글 플레이용 AAB 빌드 (업로드 키 설정은 `android-widget/README.md` 참고):

```sh
./android-widget/build-aab.sh teacher   # 또는 student
```

## 업데이트 알림

앱은 켤 때 `https://schedule.yjms.kr/app-version.json`(저장소 루트 `app-version.json`)을 읽어 설치된 `versionCode`보다 높으면 업데이트 팝업을 띄웁니다. 플레이 스토어 설치본은 스토어로, 직접 설치본은 `apkUrl`(없으면 다운로드 페이지)로 보냅니다.

- 새 APK/AAB를 배포한 **뒤에** `app-version.json`의 해당 flavor(`teacher`/`student`) `versionCode`, `versionName`, `notes`를 `build.gradle`과 같게 올립니다. 배포 전에 올리면 받을 수 없는 업데이트를 안내하게 됩니다.
- 플레이 스토어 심사가 끝나기 전에 올리면 스토어 사용자는 업데이트 버튼이 보이지 않으니 심사 완료 후 올립니다.
- `minVersionCode`를 넣으면 그보다 낮은 버전은 "나중에" 없이 업데이트를 강제합니다.

빌드 산출물은 `android/app/build/`에 생성되며 커밋하지 않습니다. keystore, APK 및 기존 `android-widget/build/` 사용자 파일을 덮어쓰거나 삭제하지 않습니다.
