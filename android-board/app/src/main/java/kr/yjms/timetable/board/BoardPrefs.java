package kr.yjms.timetable.board;

import android.content.Context;
import android.content.SharedPreferences;

/** 기기에 저장되는 칠판 설정. WebView 의 localStorage 와 달리 앱 데이터를 지우지 않는 한 남는다. */
final class BoardPrefs {

    static final String[] CLASSES = {"1-1", "1-2", "2-1", "2-2", "3-1", "3-2"};

    private static final String NAME = "board-settings";
    private static final String KEY_CLASS = "board_class";
    private static final String KEY_SOUND = "alert_sound";
    private static final String KEY_SNAPSHOT = "changes_snapshot";
    private static final String KEY_NOTICE_SNAPSHOT = "notices_snapshot";

    private BoardPrefs() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    static String className(Context context) {
        return prefs(context).getString(KEY_CLASS, "");
    }

    static void setClassName(Context context, String value) {
        prefs(context).edit().putString(KEY_CLASS, value).apply();
    }

    static boolean isConfigured(Context context) {
        return className(context).length() > 0;
    }

    static boolean soundEnabled(Context context) {
        return prefs(context).getBoolean(KEY_SOUND, true);
    }

    static void setSoundEnabled(Context context, boolean value) {
        prefs(context).edit().putBoolean(KEY_SOUND, value).apply();
    }

    /** 마지막으로 확인한 교과 변경 상태. "키=과목|메모|형식" 줄들을 정렬해 이어붙인 문자열. */
    static String snapshot(Context context) {
        return prefs(context).getString(KEY_SNAPSHOT, "");
    }

    static boolean hasSnapshot(Context context) {
        return prefs(context).contains(KEY_SNAPSHOT);
    }

    static void setSnapshot(Context context, String value) {
        prefs(context).edit().putString(KEY_SNAPSHOT, value).apply();
    }

    static void clearSnapshot(Context context) {
        prefs(context).edit().remove(KEY_SNAPSHOT).apply();
    }

    static String noticeSnapshot(Context context) {
        return prefs(context).getString(KEY_NOTICE_SNAPSHOT, "");
    }

    static boolean hasNoticeSnapshot(Context context) {
        return prefs(context).contains(KEY_NOTICE_SNAPSHOT);
    }

    static void setNoticeSnapshot(Context context, String value) {
        prefs(context).edit().putString(KEY_NOTICE_SNAPSHOT, value).apply();
    }
}
