# 용정시간표 Board APK

전자칠판 조회용 Android WebView 앱입니다.

- 앱 이름: 용정시간표 Board
- 화면: `https://schedule.yjms.kr/board`
- 푸터: `저작권 23기 하헌휘`
- 시간표 화면 오른쪽 위 `설정` 버튼으로 학급과 알림 설정 변경
- 교과 변경, 관리자 공지, 학생 호출을 확인해 시스템 알림으로 표시
- 관리자 웹에서 보낸 학생 호출은 해당 학급 화면에 크게 표시하고 경고음 재생
- 설정 화면에서 향후 웹 오버레이용 `다른 앱 위 표시` 권한 허용 가능

## 웹 오버레이 호출 규격

앱 `1.3.0`부터 `schedule.yjms.kr`의 전자칠판 페이지가 아래 주소를 열면 앱이 오버레이를 표시합니다.

```js
window.location.href = `yjboard://overlay?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}&seconds=15`;
```

`seconds`는 3~60초 범위로 제한됩니다. 결과는 `yjboardoverlayresult` 이벤트의 `event.detail.shown`으로 확인할 수 있습니다. 이 호출을 웹에 추가하기 전까지 오버레이는 표시되지 않습니다.

앱 `1.4.0`부터 전자칠판 페이지는 아래 주소로 기기 경고음을 재생할 수 있습니다. 앱 설정에서 알림 소리를 끄면 재생하지 않습니다.

```js
const bridge = document.createElement("iframe");
bridge.hidden = true;
bridge.src = "yjboard://sound";
document.body.appendChild(bridge);
```

## 빌드

```sh
./android-board/build-apk.sh
```

빌드 결과는 `android-board/output/yj-timetable-board.apk`에 생성됩니다.
