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
    private static final String PREFS_NAME = "kr.yjms.timetable.widget.PREFS";
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
        String action = intent.getAction();
        if (ACTION_REFRESH.equals(action) || AppWidgetManager.ACTION_APPWIDGET_UPDATE.equals(action)) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = intent.getIntArrayExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS);
            if (ids == null || ids.length == 0) {
                ids = manager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
            }
            refreshWidgetData(context, manager, ids);
        }
    }

    @Override
    public void onAppWidgetOptionsChanged(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId,
        Bundle newOptions
    ) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int widthDp = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250);
        int heightDp = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
        prefs.edit()
            .putInt("widget_width_dp_" + appWidgetId, widthDp)
            .putInt("widget_height_dp_" + appWidgetId, heightDp)
            .apply();

        updateWidget(context, appWidgetManager, appWidgetId);
        refreshWidgetData(context, appWidgetManager, new int[] {appWidgetId});
    }

    private static void updateWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.timetable_widget);
        Intent refreshIntent = new Intent(context, TimetableWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
            context,
            appWidgetId,
            refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_image, refreshPending);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String teacherName = prefs.getString("name", "").trim();
        String cachedTeacher = prefs.getString("last_teacher_schedule_name", "").trim();
        String cachedJson = teacherName.equals(cachedTeacher) && !teacherName.isEmpty()
            ? prefs.getString("last_teacher_schedule_json", "")
            : prefs.getString("last_timetable_json", "");
        int width = widgetSizePx(context, appWidgetManager, prefs, appWidgetId, true);
        int height = widgetSizePx(context, appWidgetManager, prefs, appWidgetId, false);
        Bitmap bitmap = LocalTimetableRenderer.drawTeacherWidget(context, cachedJson, width, height);
        views.setImageViewBitmap(R.id.widget_image, bitmap);
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static int widgetSizePx(
        Context context,
        AppWidgetManager appWidgetManager,
        SharedPreferences prefs,
        int appWidgetId,
        boolean width
    ) {
        Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
        String key = (width ? "widget_width_dp_" : "widget_height_dp_") + appWidgetId;
        int fallbackDp = width ? 250 : 110;
        String optionKey = width
            ? AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH
            : AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT;
        int sizeDp = prefs.getInt(key, options.getInt(optionKey, fallbackDp));
        sizeDp = Math.max(100, Math.min(sizeDp, 1200));
        return Math.max(1, Math.round(sizeDp * context.getResources().getDisplayMetrics().density));
    }

    private static void refreshWidgetData(
        final Context context,
        final AppWidgetManager appWidgetManager,
        final int[] appWidgetIds
    ) {
        if (appWidgetIds == null || appWidgetIds.length == 0) return;
        executor.execute(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection connection = null;
                try {
                    SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
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

                    connection = (HttpURLConnection) new URL(urlBuilder.toString()).openConnection();
                    connection.setConnectTimeout(8000);
                    connection.setReadTimeout(8000);
                    connection.connect();

                    if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return;
                    String json = readUtf8(connection.getInputStream());
                    prefs.edit().putString("last_timetable_json", json).apply();

                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            for (int appWidgetId : appWidgetIds) {
                                updateWidget(context, appWidgetManager, appWidgetId);
                            }
                        }
                    });
                } catch (Exception ignored) {
                    // Keep showing the last successfully loaded schedule while offline.
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }
        });
    }

    private static String readUtf8(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[2048];
        int length;
        while ((length = input.read(buffer)) != -1) {
            output.write(buffer, 0, length);
        }
        input.close();
        return output.toString("UTF-8");
    }
}
