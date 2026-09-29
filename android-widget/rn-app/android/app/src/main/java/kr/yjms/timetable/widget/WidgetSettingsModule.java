package kr.yjms.timetable.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

public final class WidgetSettingsModule extends ReactContextBaseJavaModule {

    private static final String PREFS_NAME = "kr.yjms.timetable.widget.PREFS";

    WidgetSettingsModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "WidgetSettings";
    }

    @ReactMethod
    public void getSettings(Promise promise) {
        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        WritableMap settings = Arguments.createMap();
        settings.putString("name", prefs.getString("name", "최세영"));
        settings.putString("subjects", prefs.getString("subjects", ""));
        settings.putString("grades", prefs.getString("grades", ""));
        settings.putString("days", prefs.getString("days", "mon,tue,wed,thu,fri"));
        settings.putString("theme", prefs.getString("widget_theme", "dark"));
        settings.putBoolean("teacherSelected", !prefs.getString("name", "").trim().isEmpty());
        promise.resolve(settings);
    }

    @ReactMethod
    public void getCachedTeacherSchedule(Promise promise) {
        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        try {
            org.json.JSONObject cached = new org.json.JSONObject();
            cached.put("teacher", prefs.getString("last_teacher_schedule_name", ""));
            cached.put("json", prefs.getString("last_teacher_schedule_json", ""));
            promise.resolve(cached.toString());
        } catch (org.json.JSONException error) {
            promise.reject("CACHE_READ_FAILED", error);
        }
    }

    @ReactMethod
    public void cacheTeacherSchedule(String json, String teacher, Promise promise) {
        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString("last_teacher_schedule_name", teacher)
            .putString("last_teacher_schedule_json", json)
            .apply();
        refreshWidgets();
        promise.resolve(null);
    }

    @ReactMethod
    public void setTeacherName(String name, Promise promise) {
        String safeName = name == null ? "" : name.trim();
        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("name", safeName).apply();
        refreshWidgets();
        promise.resolve(safeName);
    }

    @ReactMethod
    public void setTheme(String theme, Promise promise) {
        String safeTheme = "light".equals(theme) ? "light" : "dark";
        SharedPreferences prefs = getReactApplicationContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("widget_theme", safeTheme).apply();
        refreshWidgets();
        promise.resolve(safeTheme);
    }

    @ReactMethod
    public void refreshWidgets(Promise promise) {
        refreshWidgets();
        promise.resolve(null);
    }

    private void refreshWidgets() {
        Context context = getReactApplicationContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
        Intent intent = new Intent(context, TimetableWidgetProvider.class);
        intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(intent);
    }
}
