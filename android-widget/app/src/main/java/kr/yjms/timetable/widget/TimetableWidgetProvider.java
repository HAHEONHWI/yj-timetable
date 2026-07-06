package kr.yjms.timetable.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class TimetableWidgetProvider extends AppWidgetProvider {

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onUpdate(final Context context, final AppWidgetManager appWidgetManager, final int[] appWidgetIds) {
        super.onUpdate(context, appWidgetManager, appWidgetIds);

        // 비동기 스레드에서 서버 이미지 다운로드 기동
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
                    String name = prefs.getString("name", "");
                    String subjects = prefs.getString("subjects", "");
                    String grades = prefs.getString("grades", "");
                    String days = prefs.getString("days", "mon,tue,wed,thu,fri");

                    // URL 빌드
                    StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/wallpaper.png?");
                    urlBuilder.append("name=").append(URLEncoder.encode(name, "UTF-8"));
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
                        InputStream in = new BufferedInputStream(conn.getInputStream());
                        final Bitmap bitmap = BitmapFactory.decodeStream(in);
                        in.close();

                        if (bitmap != null) {
                            // 메인 UI 스레드에서 뷰 업데이트 바인딩
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    for (int appWidgetId : appWidgetIds) {
                                        updateWidgetView(context, appWidgetManager, appWidgetId, bitmap);
                                    }
                                }
                            });
                        }
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    private void updateWidgetView(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bitmap bitmap) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
        
        // 다운로드된 시간표 이미지 대입
        if (bitmap != null) {
            views.setImageViewBitmap(R.id.widget_image, bitmap);
        }

        // 위젯 터치 시 MainActivity(설정창)가 켜지도록 인텐트 매핑
        Intent intent = new Intent(context, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 
            0, 
            intent, 
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, pendingIntent);

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
