package kr.yjms.timetable.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
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

public class TimetableWidgetProvider extends AppWidgetProvider {

    private static final String ACTION_REFRESH = "kr.yjms.timetable.widget.REFRESH";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (ACTION_REFRESH.equals(intent.getAction()) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
            
            // 이미지 다운로드가 아닌, 시간표 JSON 데이터를 수신하여 로컬 캔버스 드로잉 기동
            refreshWidgetData(context, appWidgetManager, appWidgetIds);
        }
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);

        // 새로고침 수동 🔄 단추 바인딩
        Intent refreshIntent = new Intent(context, TimetableWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
            context, 
            appWidgetId, 
            refreshIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPending);

        // 위젯 바디 터치 시 설정 앱 열기 펜딩 인텐트
        Intent configIntent = new Intent(context, MainActivity.class);
        PendingIntent configPending = PendingIntent.getActivity(
            context, 
            appWidgetId, 
            configIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_image, configPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void refreshWidgetData(final Context context, final AppWidgetManager appWidgetManager, final int[] appWidgetIds) {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection conn = null;
                try {
                    SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
                    String name = prefs.getString("name", "최세영");
                    String subjects = prefs.getString("subjects", "");
                    String grades = prefs.getString("grades", "");
                    String days = prefs.getString("days", "mon,tue,wed,thu,fri");

                    // 1. 이미지(PNG)를 다운로드 받는게 아니라, JSON 데이터 포맷만 수신
                    StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/wallpaper.png?format=json");
                    urlBuilder.append("&name=").append(URLEncoder.encode(name, "UTF-8"));
                    urlBuilder.append("&subjects=").append(URLEncoder.encode(subjects, "UTF-8"));
                    urlBuilder.append("&grades=").append(URLEncoder.encode(grades, "UTF-8"));
                    urlBuilder.append("&days=").append(URLEncoder.encode(days, "UTF-8"));
                    urlBuilder.append("&v=").append(System.currentTimeMillis());

                    URL url = new URL(urlBuilder.toString());
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.connect();

                    if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        InputStream in = conn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();

                        String jsonString = out.toString("UTF-8");

                        // 2. 수신한 JSON 데이터를 사용하여 로컬 캔버스 상에 칩 병합 직접 드로잉
                        final Bitmap localBitmap = LocalTimetableRenderer.drawTimetable(context, jsonString);

                        if (localBitmap != null) {
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    for (int appWidgetId : appWidgetIds) {
                                        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
                                        views.setImageViewBitmap(R.id.widget_image, localBitmap);
                                        appWidgetManager.partiallyUpdateAppWidget(appWidgetId, views);
                                    }
                                    android.widget.Toast.makeText(context, "시간표 새로고침 완료", android.widget.Toast.LENGTH_SHORT).show();
                                }
                            });
                        }
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                } finally {
                    if (conn != null) {
                        conn.disconnect();
                    }
                }
            }
        });
    }
}
