package kr.yjms.timetable.board;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.app.NotificationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 교실마다 한 번 설정하는 화면.
 * 레이아웃 XML 없이 코드로 구성해서 빌드 스크립트에 리소스를 추가하지 않는다.
 */
public class SettingsActivity extends Activity {

    private static final int RADIO_ID_BASE = 1000;

    private RadioGroup classGroup;
    private CheckBox soundBox;
    private Button overlayPermissionButton;
    private Button fullScreenPermissionButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setPadding(64, 56, 64, 56);

        TextView title = new TextView(this);
        title.setText("전자칠판 설정");
        title.setTextSize(30);
        title.setTextColor(Color.parseColor("#1b2a4a"));
        root.addView(title);

        TextView classLabel = new TextView(this);
        classLabel.setText("이 칠판이 표시할 학급");
        classLabel.setTextSize(19);
        classLabel.setTextColor(Color.parseColor("#5b6780"));
        classLabel.setPadding(0, 44, 0, 10);
        root.addView(classLabel);

        classGroup = new RadioGroup(this);
        classGroup.setOrientation(RadioGroup.VERTICAL);
        String current = BoardPrefs.className(this);
        for (int index = 0; index < BoardPrefs.CLASSES.length; index++) {
            RadioButton option = new RadioButton(this);
            option.setId(RADIO_ID_BASE + index);
            option.setText(BoardPrefs.CLASSES[index]);
            option.setTextSize(24);
            option.setPadding(12, 14, 12, 14);
            if (BoardPrefs.CLASSES[index].equals(current)) {
                option.setChecked(true);
            }
            classGroup.addView(option);
        }
        root.addView(classGroup);

        soundBox = new CheckBox(this);
        soundBox.setText("교과 변경·공지·학생 호출 알림음 재생");
        soundBox.setTextSize(21);
        soundBox.setPadding(12, 44, 12, 14);
        soundBox.setChecked(BoardPrefs.soundEnabled(this));
        root.addView(soundBox);

        overlayPermissionButton = new Button(this);
        overlayPermissionButton.setTextSize(18);
        LinearLayout.LayoutParams overlayParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        overlayParams.topMargin = 24;
        overlayPermissionButton.setLayoutParams(overlayParams);
        overlayPermissionButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openOverlayPermission();
            }
        });
        root.addView(overlayPermissionButton);

        fullScreenPermissionButton = new Button(this);
        fullScreenPermissionButton.setTextSize(18);
        LinearLayout.LayoutParams fullScreenParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        fullScreenParams.topMargin = 12;
        fullScreenPermissionButton.setLayoutParams(fullScreenParams);
        fullScreenPermissionButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openFullScreenPermission();
            }
        });
        root.addView(fullScreenPermissionButton);

        TextView hint = new TextView(this);
        hint.setText("설정 열기: 시간표 화면 오른쪽 위의 설정 버튼을 누르세요.");
        hint.setTextSize(15);
        hint.setTextColor(Color.parseColor("#5f687a"));
        hint.setPadding(0, 36, 0, 0);
        root.addView(hint);

        Button save = new Button(this);
        save.setText("저장");
        save.setTextSize(22);
        LinearLayout.LayoutParams saveParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        saveParams.topMargin = 40;
        save.setLayoutParams(saveParams);
        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                save();
            }
        });
        root.addView(save);

        ScrollView scroll = new ScrollView(this);
        scroll.addView(root);
        setContentView(scroll);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (overlayPermissionButton == null) return;
        boolean granted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this);
        overlayPermissionButton.setText(granted
            ? "다른 앱 위 표시 권한: 허용됨"
            : "다른 앱 위 표시 권한 허용");
        overlayPermissionButton.setEnabled(!granted);
        boolean fullScreenGranted = Build.VERSION.SDK_INT < 34
            || getSystemService(NotificationManager.class).canUseFullScreenIntent();
        fullScreenPermissionButton.setText(fullScreenGranted
            ? "다른 앱 위 호출 권한: 허용됨"
            : "다른 앱 위 호출 권한 허용");
        fullScreenPermissionButton.setEnabled(!fullScreenGranted);
    }

    private void openOverlayPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getPackageName())
        );
        startActivity(intent);
    }

    private void openFullScreenPermission() {
        if (Build.VERSION.SDK_INT < 34) return;
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
            Uri.parse("package:" + getPackageName())
        );
        startActivity(intent);
    }

    private void save() {
        int checkedId = classGroup.getCheckedRadioButtonId();
        if (checkedId < RADIO_ID_BASE || checkedId >= RADIO_ID_BASE + BoardPrefs.CLASSES.length) {
            Toast.makeText(this, "학급을 선택하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        String selected = BoardPrefs.CLASSES[checkedId - RADIO_ID_BASE];
        boolean classChanged = !selected.equals(BoardPrefs.className(this));

        BoardPrefs.setClassName(this, selected);
        BoardPrefs.setSoundEnabled(this, soundBox.isChecked());
        if (classChanged) {
            // 학급이 바뀌면 이전 학급의 변경 기록을 알림으로 다시 띄우지 않는다.
            BoardPrefs.clearSnapshot(this);
        }

        ChangeWatcherService.start(this);
        Toast.makeText(this, selected + " 으로 설정했습니다.", Toast.LENGTH_SHORT).show();
        finish();
    }
}
