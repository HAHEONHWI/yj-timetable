package kr.yjms.timetable.board;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;

public class MainActivity extends Activity {

    private static final String BOARD_URL = "https://schedule.yjms.kr/board";
    private static final int REQUEST_NOTIFICATIONS = 100;

    private static volatile boolean boardVisible = false;

    private WebView webView;
    private View settingsButton;
    private String loadedClassName = "";
    private final Handler alertHandler = new Handler(Looper.getMainLooper());
    private ToneGenerator alertTone;
    private int alertToneCount;
    private final Runnable alertToneTask = new Runnable() {
        @Override
        public void run() {
            if (alertTone == null || alertToneCount <= 0) return;
            boolean started = alertTone.startTone(ToneGenerator.TONE_PROP_BEEP2, 420);
            Log.i("YJBoard", "student call beep started=" + started);
            alertToneCount--;
            if (alertToneCount > 0) {
                alertHandler.postDelayed(this, 650L);
            }
        }
    };

    /** 화면이 켜져 있으면 웹 화면이 직접 배너로 알리므로 서비스는 알림을 띄우지 않는다. */
    static boolean isBoardVisible() {
        return boardVisible;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 수업 중 화면이 저절로 꺼지지 않게 한다. 쉬는시간에 손으로 끄는 것은 그대로 가능하다.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() && "yjboard".equals(request.getUrl().getScheme())) {
                    return handleBoardCommand(view, request.getUrl());
                }
                return handleBoardCommand(view, request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleBoardCommand(view, Uri.parse(url));
            }
        });
        webView.setBackgroundColor(Color.rgb(245, 247, 251));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " YJBoardApp/1.4.0");

        FrameLayout root = new FrameLayout(this);
        root.addView(webView);
        settingsButton = buildSettingsButton();
        root.addView(settingsButton);
        setContentView(root);

        requestNotificationPermission();
    }

    private View buildSettingsButton() {
        Button button = new Button(this);
        button.setText("설정");
        button.setTextSize(17);
        button.setTextColor(Color.WHITE);
        button.setAllCaps(false);
        button.setElevation(dp(4));

        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(27, 42, 74));
        background.setCornerRadius(dp(12));
        button.setBackground(background);

        final FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
            dp(96),
            dp(48),
            Gravity.TOP | Gravity.END
        );
        params.topMargin = dp(16);
        params.setMarginEnd(dp(16));
        button.setLayoutParams(params);
        button.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            @SuppressWarnings("deprecation")
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                params.topMargin = dp(16) + insets.getSystemWindowInsetTop();
                params.setMarginEnd(dp(16) + insets.getSystemWindowInsetRight());
                view.setLayoutParams(params);
                return insets;
            }
        });
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                openSettings();
            }
        });
        return button;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void openSettings() {
        startActivity(new Intent(this, SettingsActivity.class));
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT < 33) return;
        if (checkSelfPermission("android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, REQUEST_NOTIFICATIONS);
    }

    private boolean handleBoardCommand(WebView view, Uri command) {
        if (!"yjboard".equals(command.getScheme())) return false;

        Uri current = Uri.parse(view.getUrl() == null ? "" : view.getUrl());
        if (!"https".equals(current.getScheme()) || !"schedule.yjms.kr".equals(current.getHost())) {
            return true;
        }

        if ("sound".equals(command.getHost())) {
            playStudentCallSound();
            return true;
        }
        if ("call-end".equals(command.getHost())) {
            settingsButton.setVisibility(View.VISIBLE);
            return true;
        }
        if (!"overlay".equals(command.getHost())) return true;

        String title = command.getQueryParameter("title");
        String body = command.getQueryParameter("body");
        int seconds = 15;
        String secondsValue = command.getQueryParameter("seconds");
        if (secondsValue != null && secondsValue.matches("[0-9]{1,3}")) {
            seconds = Integer.parseInt(secondsValue);
        }
        seconds = Math.max(3, Math.min(60, seconds));
        boolean shown = BoardOverlay.show(
            this,
            title == null ? "학교 알림" : title,
            body == null ? "" : body,
            seconds * 1000L
        );
        view.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('yjboardoverlayresult',{detail:{shown:" + shown + "}}))",
            null
        );
        return true;
    }

    private void playStudentCallSound() {
        settingsButton.setVisibility(View.GONE);
        if (!BoardPrefs.soundEnabled(this)) return;
        alertHandler.removeCallbacks(alertToneTask);
        if (alertTone != null) alertTone.release();
        alertTone = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 100);
        alertToneCount = 3;
        alertToneTask.run();
        Log.i("YJBoard", "student call sound started");
    }

    @Override
    protected void onResume() {
        super.onResume();
        boardVisible = true;

        if (!BoardPrefs.isConfigured(this)) {
            openSettings();
            return;
        }

        String className = BoardPrefs.className(this);
        if (!className.equals(loadedClassName)) {
            loadedClassName = className;
            webView.loadUrl(BOARD_URL + "?class=" + className);
        }
        ChangeWatcherService.start(this);
    }

    @Override
    protected void onPause() {
        boardVisible = false;
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        alertHandler.removeCallbacks(alertToneTask);
        if (alertTone != null) {
            alertTone.release();
            alertTone = null;
        }
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
