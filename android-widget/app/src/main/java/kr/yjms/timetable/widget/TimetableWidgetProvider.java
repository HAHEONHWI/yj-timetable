package kr.yjms.timetable.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class TimetableWidgetProvider extends AppWidgetProvider {

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());
    private static final String ACTION_REFRESH = "kr.yjms.timetable.widget.ACTION_REFRESH";

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    @Override
    public void onUpdate(final Context context, final AppWidgetManager appWidgetManager, final int[] appWidgetIds) {
        super.onUpdate(context, appWidgetManager, appWidgetIds);

        // 비동기 스레드에서 서버 JSON 데이터 갱신 기동
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
                    String name = prefs.getString("name", "");
                    String subjects = prefs.getString("subjects", "");
                    String grades = prefs.getString("grades", "");
                    String days = prefs.getString("days", "mon,tue,wed,thu,fri");

                    // JSON API URL 빌드
                    StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/wallpaper.png?format=json");
                    urlBuilder.append("&name=").append(URLEncoder.encode(name, "UTF-8"));
                    urlBuilder.append("&subjects=").append(URLEncoder.encode(subjects, "UTF-8"));
                    urlBuilder.append("&grades=").append(URLEncoder.encode(grades, "UTF-8"));
                    urlBuilder.append("&days=").append(URLEncoder.encode(days, "UTF-8"));
                    urlBuilder.append("&v=").append(System.currentTimeMillis()); // 캐시 우회

                    URL url = new URL(urlBuilder.toString());
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.connect();

                    int responseCode = conn.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_OK) {
                        InputStream in = conn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();
                        
                        final String jsonString = out.toString("UTF-8");
                        
                        // 메인 UI 스레드에서 위젯 바인딩 기동
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                for (int appWidgetId : appWidgetIds) {
                                    updateWidgetTextGrid(context, appWidgetManager, appWidgetId, jsonString);
                                }
                            }
                        });
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                    // 에러 발생 시 뷰에 실패 메시지를 출력하여 피드백 제공
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            for (int appWidgetId : appWidgetIds) {
                                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
                                views.setTextViewText(R.id.widget_title, "연결 실패 (🔄 눌러서 재시도)");
                                appWidgetManager.updateAppWidget(appWidgetId, views);
                            }
                        }
                    });
                }
            }
        });
    }

    private void updateWidgetTextGrid(Context context, AppWidgetManager appWidgetManager, int appWidgetId, String jsonString) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
        
        // 새로고침 버튼 방송 인텐트 바인딩
        Intent refreshIntent = new Intent(context, TimetableWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent pendingRefresh = PendingIntent.getBroadcast(
            context, 
            0, 
            refreshIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, pendingRefresh);

        // 위젯 빈 영역 터치 시 설정화면 실행 인텐트 바인딩
        Intent configIntent = new Intent(context, MainActivity.class);
        PendingIntent pendingConfig = PendingIntent.getActivity(
            context, 
            1, 
            configIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingConfig);

        try {
            JSONObject root = new JSONObject(jsonString);
            JSONArray gridArr = root.getJSONArray("grid");
            
            // 45개 셀에 네이티브 텍스트 및 컬러 바인딩
            for (int d = 0; d < 5; d++) {
                JSONArray dayRow = gridArr.optJSONArray(d);
                for (int p = 0; p < 9; p++) {
                    int viewId = context.getResources().getIdentifier("cell_" + d + "_" + p, "id", context.getPackageName());
                    if (viewId == 0) continue;

                    JSONArray cellMatches = (dayRow != null) ? dayRow.optJSONArray(p) : null;
                    if (cellMatches != null && cellMatches.length() > 0) {
                        JSONObject match = cellMatches.getJSONObject(0);
                        String title = match.getString("title");
                        String note = match.optString("note", "");
                        String type = match.optString("type", "");

                        String dispText = title;
                        if (note != null && !note.isEmpty()) {
                            dispText = title + "\n" + note;
                        }
                        
                        views.setTextViewText(viewId, dispText);
                        
                        // 타입별 다크 테마 컬러 바인딩
                        if ("event".equals(type)) {
                            views.setInt(viewId, "setBackgroundColor", 0xFF0A252B); // 민트 어두움
                            views.setTextColor(viewId, 0xFF2DD4BF); // 민트 텍스트
                        } else if ("change".equals(type)) {
                            views.setInt(viewId, "setBackgroundColor", 0xFF2B1B0A); // 오렌지 어두움
                            views.setTextColor(viewId, 0xFFF59E0B); // 오렌지 텍스트
                        } else if ("original".equals(type)) {
                            views.setInt(viewId, "setBackgroundColor", 0xFF171D26); // 회색 어두움
                            views.setTextColor(viewId, 0xFF94A3B8); // 회색 텍스트
                        } else {
                            views.setInt(viewId, "setBackgroundColor", 0xFF1E293B); // 기본 남색
                            views.setTextColor(viewId, 0xFFF8FAFC); // 기본 흰색
                        }
                    } else {
                        // 빈 셀 초기화
                        views.setTextViewText(viewId, "");
                        views.setInt(viewId, "setBackgroundColor", 0xFF1E293B);
                    }
                }
            }
            views.setTextViewText(R.id.widget_title, "용정시간표");
        } catch (Exception e) {
            e.printStackTrace();
            views.setTextViewText(R.id.widget_title, "데이터 파싱 에러");
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
