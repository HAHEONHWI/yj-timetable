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
        settings.putString("name", prefs.getString("name", ""));
        settings.putString("subjects", prefs.getString("subjects", ""));
        settings.putString("grades", prefs.getString("grades", ""));
        settings.putString("days", prefs.getString("days", "mon,tue,wed,thu,fri"));
        settings.putString("theme", prefs.getString("widget_theme", "dark"));
        settings.putString("audience", BuildConfig.AUDIENCE);
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

    /** 학생용: 전 학급 응답에서 우리 반만 교사 시간표 형식으로 바꿔 위젯 캐시에 저장한다. */
    @ReactMethod
    public void cacheClassSchedule(String classesJson, String className, Promise promise) {
        try {
            String json = TeacherNotifications.classToScheduleJson(classesJson, className);
            if (json != null) TeacherNotifications.cacheSchedule(getReactApplicationContext(), className, json);
            refreshWidgets();
            promise.resolve(json);
        } catch (Exception error) {
            promise.reject("CLASS_CACHE_FAILED", error);
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
        boolean changed = !safeName.equals(prefs.getString("name", ""));
        prefs.edit().putString("name", safeName).apply();
        if (changed) {
            TeacherNotifications.resetChangeBaseline(getReactApplicationContext());
            captureChangeBaseline();
        }
        refreshWidgets();
        promise.resolve(safeName);
    }

    @ReactMethod
    public void getNotificationSettings(Promise promise) {
        SharedPreferences prefs = TeacherNotifications.prefs(getReactApplicationContext());
        WritableMap settings = Arguments.createMap();
        settings.putBoolean("changes", prefs.getBoolean(TeacherNotifications.KEY_CHANGES, false));
        settings.putBoolean("daily", prefs.getBoolean(TeacherNotifications.KEY_DAILY, false));
        settings.putBoolean("setupDone", prefs.getBoolean(TeacherNotifications.KEY_SETUP_DONE, false));
        promise.resolve(settings);
    }

    @ReactMethod
    public void setNotificationSettings(boolean changes, boolean daily, Promise promise) {
        Context context = getReactApplicationContext();
        SharedPreferences prefs = TeacherNotifications.prefs(context);
        boolean changesTurnedOn = changes && !prefs.getBoolean(TeacherNotifications.KEY_CHANGES, false);
        prefs.edit()
            .putBoolean(TeacherNotifications.KEY_CHANGES, changes)
            .putBoolean(TeacherNotifications.KEY_DAILY, daily)
            .putBoolean(TeacherNotifications.KEY_SETUP_DONE, true)
            .apply();
        if (changesTurnedOn) {
            TeacherNotifications.resetChangeBaseline(context);
            captureChangeBaseline();
        }
        TeacherNotifications.applySchedules(context);
        promise.resolve(null);
    }

    @ReactMethod
    public void syncNotifications(Promise promise) {
        TeacherNotifications.applySchedules(getReactApplicationContext());
        promise.resolve(null);
    }

    /** 알림을 켜거나 교사를 바꾼 시점의 변경 목록을 기준으로 저장해, 이미 있던 변경은 알리지 않는다. */
    private void captureChangeBaseline() {
        final Context context = getReactApplicationContext().getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                TeacherNotifications.checkChanges(context);
            }
        }).start();
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

    /** 업데이트 확인용: 설치된 버전과 설치 경로(플레이 스토어인지 직접 APK인지)를 알려 준다. */
    @ReactMethod
    public void getAppInfo(Promise promise) {
        Context context = getReactApplicationContext();
        WritableMap info = Arguments.createMap();
        info.putInt("versionCode", BuildConfig.VERSION_CODE);
        info.putString("versionName", BuildConfig.VERSION_NAME);
        info.putString("audience", BuildConfig.AUDIENCE);
        info.putString("packageName", context.getPackageName());
        String installer = null;
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
                installer = context.getPackageManager()
                    .getInstallSourceInfo(context.getPackageName())
                    .getInstallingPackageName();
            } else {
                installer = context.getPackageManager().getInstallerPackageName(context.getPackageName());
            }
        } catch (Exception ignored) {
            // 설치 경로를 모르면 직접 배포 APK로 본다.
        }
        info.putString("installer", installer == null ? "" : installer);
        promise.resolve(info);
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
