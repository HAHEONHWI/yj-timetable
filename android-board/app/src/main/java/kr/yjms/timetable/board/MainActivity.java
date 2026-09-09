package kr.yjms.timetable.board;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public class MainActivity extends Activity {

    private static final String BOARD_URL = "https://schedule.yjms.kr/board";
    private static final long SETTINGS_LONG_PRESS_MS = 3000L;
    private static final int CORNER_SIZE_DP = 120;
    private static final int REQUEST_NOTIFICATIONS = 100;

    private static volatile boolean boardVisible = false;

    private WebView webView;
    private String loadedClassName = "";
    private final Handler longPressHandler = new Handler(Looper.getMainLooper());

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
                    return true;
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

        FrameLayout root = new FrameLayout(this);
        root.addView(webView);
        root.addView(buildSettingsCorner());
        setContentView(root);

        requestNotificationPermission();
    }

    /** 왼쪽 위 모서리를 길게 누르면 설정이 열린다. 학생이 우연히 누르지 못하게 3초를 요구한다. */
    private View buildSettingsCorner() {
        int size = Math.round(CORNER_SIZE_DP * getResources().getDisplayMetrics().density);
        View corner = new View(this);
        corner.setLayoutParams(new FrameLayout.LayoutParams(size, size, Gravity.TOP | Gravity.START));

        final Runnable openSettings = new Runnable() {
            @Override
            public void run() {
                openSettings();
            }
        };

        corner.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View view, MotionEvent event) {
                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        longPressHandler.postDelayed(openSettings, SETTINGS_LONG_PRESS_MS);
                        return true;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        longPressHandler.removeCallbacks(openSettings);
                        return true;
                    default:
                        return true;
                }
            }
        });
        return corner;
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
        if (!"overlay".equals(command.getHost())) return true;

        Uri current = Uri.parse(view.getUrl() == null ? "" : view.getUrl());
        if (!"https".equals(current.getScheme()) || !"schedule.yjms.kr".equals(current.getHost())) {
            return true;
        }

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
        longPressHandler.removeCallbacksAndMessages(null);
        super.onPause();
    }
}
