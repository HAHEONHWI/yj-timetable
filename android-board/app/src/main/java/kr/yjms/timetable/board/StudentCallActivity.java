package kr.yjms.timetable.board;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class StudentCallActivity extends Activity {

    private ToneGenerator tone;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );
        if (android.os.Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        }

        String student = getIntent().getStringExtra("student_name");
        String destination = getIntent().getStringExtra("destination");
        String message = getIntent().getStringExtra("message");
        String className = getIntent().getStringExtra("class_name");

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(8, 15, 29));
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(48), dp(42), dp(48), dp(36));
        GradientDrawable cardBackground = new GradientDrawable();
        cardBackground.setColor(Color.rgb(27, 42, 74));
        cardBackground.setCornerRadius(dp(24));
        card.setBackground(cardBackground);

        TextView label = text("학생 호출", 24, Color.rgb(183, 213, 255));
        TextView name = text(student == null ? "학생" : student, 58, Color.WHITE);
        TextView place = text((destination == null ? "교무실" : destination) + "로 와 주세요.", 30, Color.WHITE);
        TextView detail = text(message == null ? "" : message, 22, Color.rgb(222, 231, 246));
        TextView target = text((className == null ? "" : className) + " 학생", 20, Color.rgb(185, 198, 220));
        Button close = new Button(this);
        close.setText("×");
        close.setContentDescription("호출 닫기");
        close.setTextSize(42);
        close.setTextColor(Color.rgb(27, 42, 74));
        close.setAllCaps(false);
        close.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                finishAndRemoveTask();
            }
        });

        card.addView(label, params(0, 0, 0, 10));
        card.addView(name, params(0, 0, 0, 14));
        card.addView(place, params(0, 0, 0, message == null || message.length() == 0 ? 8 : 4));
        if (message != null && message.length() > 0) card.addView(detail, params(0, 0, 0, 8));
        card.addView(target, params(0, 0, 0, 20));
        card.addView(close, new LinearLayout.LayoutParams(dp(86), dp(86)));

        FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
            -1, -2, Gravity.CENTER
        );
        cardParams.leftMargin = dp(42);
        cardParams.rightMargin = dp(42);
        root.addView(card, cardParams);
        setContentView(root);
        playSound();
    }

    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private LinearLayout.LayoutParams params(int left, int top, int right, int bottom) {
        LinearLayout.LayoutParams result = new LinearLayout.LayoutParams(-1, -2);
        result.setMargins(dp(left), dp(top), dp(right), dp(bottom));
        return result;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void playSound() {
        if (!BoardPrefs.soundEnabled(this)) return;
        tone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
        tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 420);
        new android.os.Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                if (tone != null) tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 420);
            }
        }, 650L);
        new android.os.Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                if (tone != null) tone.startTone(ToneGenerator.TONE_PROP_BEEP2, 420);
            }
        }, 1300L);
    }

    @Override
    protected void onDestroy() {
        if (tone != null) {
            tone.release();
            tone = null;
        }
        super.onDestroy();
    }
}
