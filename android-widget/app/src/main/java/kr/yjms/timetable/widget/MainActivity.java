package kr.yjms.timetable.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.net.URLEncoder;

public class MainActivity extends Activity {

    private WebView webDashboard;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webDashboard = (WebView) findViewById(R.id.web_dashboard);

        // 웹뷰 하이브리드 환경 설정
        WebSettings webSettings = webDashboard.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webDashboard.setWebViewClient(new WebViewClient());

        // 자바스크립트 브릿지 심기 (웹뷰 내 과목/요일 칩 선택 시 실시간 동기화)
        webDashboard.addJavascriptInterface(new WebAppInterface(this), "AndroidApp");

        // 대시보드 로드
        reloadDashboard();
    }

    private void reloadDashboard() {
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        
        // "이름 빼고 해" 요구사항에 따라 이름은 최세영으로 고정/프리필하고 편집 불필요화
        String name = prefs.getString("name", "최세영");
        
        // 기존 필터 데이터 로드
        String subjects = prefs.getString("subjects", "");
        String grades = prefs.getString("grades", "");
        String days = prefs.getString("days", "mon,tue,wed,thu,fri");

        try {
            // 하이브리드 연동을 위한 app=true 분기와 해시 라우팅(#/wallpaper) 매칭
            StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/?app=true");
            urlBuilder.append("&name=").append(URLEncoder.encode(name, "UTF-8"));
            urlBuilder.append("&subjects=").append(URLEncoder.encode(subjects, "UTF-8"));
            urlBuilder.append("&grades=").append(URLEncoder.encode(grades, "UTF-8"));
            urlBuilder.append("&days=").append(URLEncoder.encode(days, "UTF-8"));
            urlBuilder.append("&v=").append(System.currentTimeMillis()); // 캐시 우회
            urlBuilder.append("#/wallpaper");
            
            webDashboard.loadUrl(urlBuilder.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // 자바스크립트 인터페이스 브릿지 클래스 정의
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void saveFilters(String subjects, String grades, String days) {
            SharedPreferences prefs = mContext.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("subjects", subjects);
            editor.putString("grades", grades);
            editor.putString("days", days);
            editor.apply();

            // 바탕화면 위젯 강제 업데이트 브로드캐스트 인텐트 전송 (실시간 즉각 동기화)
            Intent widgetIntent = new Intent(mContext, TimetableWidgetProvider.class);
            widgetIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            
            AppWidgetManager widgetManager = AppWidgetManager.getInstance(mContext);
            int[] ids = widgetManager.getAppWidgetIds(new ComponentName(mContext, TimetableWidgetProvider.class));
            widgetIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            mContext.sendBroadcast(widgetIntent);
        }
    }
}
