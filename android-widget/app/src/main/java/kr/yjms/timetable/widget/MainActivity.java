package kr.yjms.timetable.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;
import java.net.URLEncoder;

public class MainActivity extends Activity {

    private WebView webDashboard;
    private EditText editName;
    private EditText editSubjects;
    private EditText editGrades;
    private EditText editDays;
    private Button btnSave;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webDashboard = (WebView) findViewById(R.id.web_dashboard);
        editName = (EditText) findViewById(R.id.edit_name);
        editSubjects = (EditText) findViewById(R.id.edit_subjects);
        editGrades = (EditText) findViewById(R.id.edit_grades);
        editDays = (EditText) findViewById(R.id.edit_days);
        btnSave = (Button) findViewById(R.id.btn_save);

        // 웹뷰 환경 설정 (실시간 대시보드 조회용)
        WebSettings webSettings = webDashboard.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webDashboard.setWebViewClient(new WebViewClient());

        final SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        
        // 기존 설정 값 불러오기
        editName.setText(prefs.getString("name", ""));
        editSubjects.setText(prefs.getString("subjects", ""));
        editGrades.setText(prefs.getString("grades", ""));
        editDays.setText(prefs.getString("days", "mon,tue,wed,thu,fri"));

        // 대시보드 최초 로드
        reloadDashboard();

        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String name = editName.getText().toString().trim();
                String subjects = editSubjects.getText().toString().trim();
                String grades = editGrades.getText().toString().trim();
                String days = editDays.getText().toString().trim();

                // 설정 저장
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("name", name);
                editor.putString("subjects", subjects);
                editor.putString("grades", grades);
                editor.putString("days", days);
                editor.apply();

                Toast.makeText(MainActivity.this, "설정이 저장되었습니다. 대시보드 및 위젯을 갱신합니다.", Toast.LENGTH_SHORT).show();

                // 대시보드 새로고침
                reloadDashboard();

                // 바탕화면 위젯 강제 업데이트 브로드캐스트 인텐트 전송
                Context context = getApplicationContext();
                Intent widgetIntent = new Intent(context, TimetableWidgetProvider.class);
                widgetIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                
                AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
                int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
                widgetIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(widgetIntent);
            }
        });
    }

    private void reloadDashboard() {
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        String name = prefs.getString("name", "");
        String subjects = prefs.getString("subjects", "");
        String grades = prefs.getString("grades", "");
        String days = prefs.getString("days", "mon,tue,wed,thu,fri");

        try {
            StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/?");
            urlBuilder.append("name=").append(URLEncoder.encode(name, "UTF-8"));
            urlBuilder.append("&subjects=").append(URLEncoder.encode(subjects, "UTF-8"));
            urlBuilder.append("&grades=").append(URLEncoder.encode(grades, "UTF-8"));
            urlBuilder.append("&days=").append(URLEncoder.encode(days, "UTF-8"));
            urlBuilder.append("&v=").append(System.currentTimeMillis()); // 캐시 우회
            
            webDashboard.loadUrl(urlBuilder.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
