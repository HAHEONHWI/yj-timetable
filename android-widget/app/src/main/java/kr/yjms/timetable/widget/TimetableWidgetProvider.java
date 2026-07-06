package kr.yjms.timetable.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Bundle;
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
            
            refreshWidgetData(context, appWidgetManager, appWidgetIds);
        }
    }

    // 위젯 크기 변경 감지 리액티브 콜백 오버라이드
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);

        // 변경된 크기(DP) 불러오기
        int minWidth = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 294);
        int minHeight = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 294);

        // DP를 픽셀 해상도로 변환 (고선명을 위해 2.5배 스케일링)
        int targetWidth = (int) (minWidth * 2.5f);
        int targetHeight = (int) (minHeight * 2.5f);

        // 위젯 크기를 SharedPreferences에 캐싱 보관
        SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        prefs.edit()
             .putInt("widget_w_" + appWidgetId, targetWidth)
             .putInt("widget_h_" + appWidgetId, targetHeight)
             .apply();

        // 즉시 해당 위젯의 시간표 렌더링 리빌드 가동
        refreshWidgetData(context, appWidgetManager, new int[]{appWidgetId});
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);

        // 1. 새로고침 수동 🔄 단추 바인딩
        Intent refreshIntent = new Intent(context, TimetableWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
            context, 
            appWidgetId, 
            refreshIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPending);

        // 2. 위젯 바디 터치 시에도 새로고침 작동
        views.setOnClickPendingIntent(R.id.widget_image, refreshPending);

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

                        final String jsonString = out.toString("UTF-8");

                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("MM/dd HH:mm", java.util.Locale.KOREA);
                                final String updateText = "갱신: " + sdf.format(new java.util.Date());

                                SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);

                                // 개별 위젯의 가로세로 크기를 획득하여 최적 비트맵으로 각각 드로잉
                                for (int appWidgetId : appWidgetIds) {
                                    int w = prefs.getInt("widget_w_" + appWidgetId, 1000);
                                    int h = prefs.getInt("widget_h_" + appWidgetId, 850);
                                    
                                    Bitmap localBitmap = LocalTimetableRenderer.drawTimetable(context, jsonString, w, h);

                                    if (localBitmap != null) {
                                        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
                                        views.setImageViewBitmap(R.id.widget_image, localBitmap);
                                        views.setTextViewText(R.id.widget_last_update, updateText);
                                        
                                        // 🔄 클릭이벤트 재바인딩 누락 방지
                                        Intent refreshIntent = new Intent(context, TimetableWidgetProvider.class);
                                        refreshIntent.setAction(ACTION_REFRESH);
                                        PendingIntent refreshPending = PendingIntent.getBroadcast(
                                            context, 
                                            appWidgetId, 
                                            refreshIntent, 
                                            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                                        );
                                        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPending);
                                        views.setOnClickPendingIntent(R.id.widget_image, refreshPending);

                                        appWidgetManager.partiallyUpdateAppWidget(appWidgetId, views);
                                    }
                                }
                                android.widget.Toast.makeText(context, "시간표 새로고침 완료", android.widget.Toast.LENGTH_SHORT).show();
                            }
                        });
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
