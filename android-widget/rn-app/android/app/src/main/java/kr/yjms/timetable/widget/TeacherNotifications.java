package kr.yjms.timetable.widget;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 교과 변경 알림과 매일 아침 수업 알림.
 * 서버 푸시 없이 기기에서 교사 시간표를 주기적으로 받아 비교한다.
 */
final class TeacherNotifications {

    static final String PREFS_NAME = "kr.yjms.timetable.widget.PREFS";
    static final String KEY_CHANGES = "notify_changes";
    static final String KEY_DAILY = "notify_daily";
    static final String KEY_SETUP_DONE = "notify_setup_done";
    private static final String KEY_SEEN_CHANGES = "seen_change_keys";
    private static final String KEY_SEEN_TEACHER = "seen_change_teacher";

    private static final String CHANNEL_CHANGES = "lesson_changes";
    private static final String CHANNEL_DAILY = "daily_lessons";
    private static final int CHANGE_JOB_ID = 4101;
    private static final int DAILY_ALARM_REQUEST = 4102;
    private static final int CHANGE_NOTIFICATION_ID = 4201;
    private static final int DAILY_NOTIFICATION_ID = 4202;
    private static final int DAILY_HOUR = 8;
    private static final long CHANGE_CHECK_INTERVAL_MS = 60L * 60L * 1000L;
    private static final TimeZone KOREA = TimeZone.getTimeZone("Asia/Seoul");

    private TeacherNotifications() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /** 저장된 설정에 맞춰 아침 알람과 변경 확인 작업을 등록하거나 해제한다. */
    static void applySchedules(Context context) {
        SharedPreferences prefs = prefs(context);
        scheduleDaily(context, prefs.getBoolean(KEY_DAILY, false));
        scheduleChangeCheck(context, prefs.getBoolean(KEY_CHANGES, false));
    }

    /** 교사가 바뀌면 이전 교사의 변경 목록으로 비교하지 않도록 기준을 비운다. */
    static void resetChangeBaseline(Context context) {
        prefs(context).edit().remove(KEY_SEEN_CHANGES).remove(KEY_SEEN_TEACHER).apply();
    }

    private static void scheduleDaily(Context context, boolean enabled) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            DAILY_ALARM_REQUEST,
            new Intent(context, DailyLessonReceiver.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        alarmManager.cancel(pending);
        if (!enabled) return;

        Calendar next = Calendar.getInstance(KOREA);
        next.set(Calendar.HOUR_OF_DAY, DAILY_HOUR);
        next.set(Calendar.MINUTE, 0);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_MONTH, 1);
        // 정확한 알람 권한 없이 도즈 모드에서도 울리도록 한다. 몇 분 늦을 수 있다.
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
    }

    private static void scheduleChangeCheck(Context context, boolean enabled) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        if (!enabled) {
            scheduler.cancel(CHANGE_JOB_ID);
            return;
        }
        if (scheduler.getPendingJob(CHANGE_JOB_ID) != null) return;
        JobInfo job = new JobInfo.Builder(CHANGE_JOB_ID, new ComponentName(context, ChangeCheckJobService.class))
            .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
            .setPeriodic(CHANGE_CHECK_INTERVAL_MS)
            .setPersisted(true)
            .build();
        try {
            scheduler.schedule(job);
        } catch (RuntimeException error) {
            // 예약이 거부돼도 앱과 아침 알림은 계속 동작해야 한다.
        }
    }

    static boolean isStudent() {
        return "student".equals(BuildConfig.AUDIENCE);
    }

    /** 교사용은 교사 이름, 학생용은 학급(예: 2-1)이 "name"에 저장된다. */
    static String teacherName(Context context) {
        return prefs(context).getString("name", "").trim();
    }

    /** 위젯 제목용 이름. 학생용은 "2-1반"처럼 보여 준다. */
    static String targetLabel(String name) {
        String value = name == null ? "" : name.trim();
        if (value.isEmpty()) return isStudent() ? "반 선택 필요" : "교사 선택 필요";
        return isStudent() ? value + "반" : value;
    }

    /**
     * 학급 시간표 응답(format=classes)에서 한 반을 골라 교사 시간표와 같은 형식으로 바꾼다.
     * 위젯과 알림이 같은 코드를 쓰도록 과목명을 className 자리에 넣는다.
     */
    static String classToScheduleJson(String classesJson, String className) throws Exception {
        JSONObject source = new JSONObject(classesJson);
        JSONArray rows = source.getJSONObject("timetables").optJSONArray(className);
        if (rows == null) return null;
        JSONArray grid = new JSONArray();
        for (int dayIndex = 0; dayIndex < rows.length(); dayIndex++) {
            JSONArray dayRow = rows.getJSONArray(dayIndex);
            JSONArray dayOut = new JSONArray();
            for (int periodIndex = 0; periodIndex < dayRow.length(); periodIndex++) {
                JSONObject lesson = dayRow.getJSONObject(periodIndex);
                JSONArray matches = new JSONArray();
                String subject = lesson.optString("title").trim();
                if (!subject.isEmpty()) {
                    String type = lesson.optString("type");
                    JSONObject match = new JSONObject();
                    match.put("className", subject);
                    match.put("title", "");
                    match.put("teacher", lesson.optString("teacher"));
                    match.put("type", "merge".equals(type) ? "event" : type);
                    match.put("note", "change".equals(type) ? "변경" : "new".equals(type) ? "신설 수업" : "");
                    matches.put(match);
                }
                dayOut.put(matches);
            }
            grid.put(dayOut);
        }
        JSONObject result = new JSONObject();
        result.put("days", source.optJSONArray("days"));
        result.put("periods", source.optJSONArray("periods"));
        result.put("grid", grid);
        return result.toString();
    }

    static void cacheSchedule(Context context, String target, String json) {
        prefs(context).edit()
            .putString("last_teacher_schedule_name", target)
            .putString("last_teacher_schedule_json", json)
            .apply();
    }

    /** 교사(또는 학급) 시간표 JSON을 받아 위젯 캐시에도 저장한다. 실패하면 null. */
    static String fetchTeacherSchedule(Context context, String teacher) {
        HttpURLConnection connection = null;
        try {
            String url = isStudent()
                ? "https://schedule.yjms.kr/wallpaper.png?format=classes&v=" + System.currentTimeMillis()
                : "https://schedule.yjms.kr/wallpaper.png?format=json&teacher="
                    + URLEncoder.encode(teacher, "UTF-8") + "&v=" + System.currentTimeMillis();
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            String json = readUtf8(connection.getInputStream());
            if (isStudent()) json = classToScheduleJson(json, teacher);
            if (json == null) return null;
            new JSONObject(json);
            cacheSchedule(context, teacher, json);
            return json;
        } catch (Exception error) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String cachedTeacherSchedule(Context context, String teacher) {
        SharedPreferences prefs = prefs(context);
        if (!teacher.equals(prefs.getString("last_teacher_schedule_name", ""))) return null;
        String json = prefs.getString("last_teacher_schedule_json", "");
        return json.isEmpty() ? null : json;
    }

    static String todayIso() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(KOREA);
        return format.format(new java.util.Date());
    }

    static boolean isWeekendInKorea() {
        int day = Calendar.getInstance(KOREA).get(Calendar.DAY_OF_WEEK);
        return day == Calendar.SATURDAY || day == Calendar.SUNDAY;
    }

    /** 아침 알림: 오늘 수업 목록을 보낸다. 네트워크가 안 되면 마지막 캐시를 쓴다. */
    static void sendDailyLessons(Context context) {
        if (!prefs(context).getBoolean(KEY_DAILY, false) || isWeekendInKorea()) return;
        String teacher = teacherName(context);
        if (teacher.isEmpty()) return;
        String json = fetchTeacherSchedule(context, teacher);
        if (json == null) json = cachedTeacherSchedule(context, teacher);
        if (json == null) return;

        try {
            JSONObject schedule = new JSONObject(json);
            JSONArray days = schedule.optJSONArray("days");
            JSONArray grid = schedule.optJSONArray("grid");
            JSONArray periods = schedule.optJSONArray("periods");
            if (days == null || grid == null) return;
            String today = todayIso();
            int dayIndex = -1;
            for (int index = 0; index < days.length(); index++) {
                if (today.equals(days.getJSONObject(index).optString("iso"))) dayIndex = index;
            }
            if (dayIndex < 0) return;

            List<String> lines = new ArrayList<>();
            JSONArray dayRow = grid.optJSONArray(dayIndex);
            for (int periodIndex = 0; dayRow != null && periodIndex < dayRow.length(); periodIndex++) {
                JSONArray matches = dayRow.optJSONArray(periodIndex);
                for (int matchIndex = 0; matches != null && matchIndex < matches.length(); matchIndex++) {
                    JSONObject match = matches.getJSONObject(matchIndex);
                    int period = periods != null ? periods.optInt(periodIndex, periodIndex + 1) : periodIndex + 1;
                    lines.add(lessonLine(period, periodIndex, match, true));
                }
            }

            String title = lines.isEmpty() ? "오늘은 예정된 수업이 없습니다" : "오늘 수업 " + lines.size() + "개";
            String greeting = isStudent() ? "오늘도 좋은 하루 보내세요." : teacher + " 선생님, 좋은 하루 보내세요.";
            String body = lines.isEmpty() ? greeting : join(lines);
            notify(context, CHANNEL_DAILY, DAILY_NOTIFICATION_ID, title, body);
        } catch (Exception ignored) {
            // 형식이 맞지 않는 응답이면 이번 알림은 건너뛴다.
        }
    }

    /** 변경 확인: 처음 확인하거나 교사가 바뀐 경우에는 기준만 저장하고 알리지 않는다. */
    static void checkChanges(Context context) {
        SharedPreferences prefs = prefs(context);
        if (!prefs.getBoolean(KEY_CHANGES, false)) return;
        String teacher = teacherName(context);
        if (teacher.isEmpty()) return;
        String json = fetchTeacherSchedule(context, teacher);
        if (json == null) return;

        try {
            JSONObject schedule = new JSONObject(json);
            JSONArray days = schedule.optJSONArray("days");
            JSONArray grid = schedule.optJSONArray("grid");
            JSONArray periods = schedule.optJSONArray("periods");
            if (days == null || grid == null) return;

            String today = todayIso();
            Set<String> current = new HashSet<>();
            List<String> newLines = new ArrayList<>();
            Set<String> seen = prefs.getStringSet(KEY_SEEN_CHANGES, null);
            boolean hasBaseline = seen != null && teacher.equals(prefs.getString(KEY_SEEN_TEACHER, ""));

            for (int dayIndex = 0; dayIndex < days.length() && dayIndex < grid.length(); dayIndex++) {
                JSONObject day = days.getJSONObject(dayIndex);
                String iso = day.optString("iso");
                JSONArray dayRow = grid.optJSONArray(dayIndex);
                for (int periodIndex = 0; dayRow != null && periodIndex < dayRow.length(); periodIndex++) {
                    JSONArray matches = dayRow.optJSONArray(periodIndex);
                    for (int matchIndex = 0; matches != null && matchIndex < matches.length(); matchIndex++) {
                        JSONObject match = matches.getJSONObject(matchIndex);
                        String type = match.optString("type");
                        if (!"change".equals(type) && !"new".equals(type)) continue;
                        int period = periods != null ? periods.optInt(periodIndex, periodIndex + 1) : periodIndex + 1;
                        String key = iso + "|" + period + "|" + match.optString("className") + "|"
                            + match.optString("title") + "|" + type;
                        current.add(key);
                        if (hasBaseline && !seen.contains(key) && iso.compareTo(today) >= 0) {
                            newLines.add(dayLabel(iso, day.optString("label")) + " " + lessonLine(period, periodIndex, match, false));
                        }
                    }
                }
            }

            prefs.edit()
                .putStringSet(KEY_SEEN_CHANGES, current)
                .putString(KEY_SEEN_TEACHER, teacher)
                .apply();
            if (newLines.isEmpty()) return;
            String title = newLines.size() == 1 ? "교과 변경 알림" : "교과 변경 " + newLines.size() + "건";
            notify(context, CHANNEL_CHANGES, CHANGE_NOTIFICATION_ID, title, join(newLines));
        } catch (Exception ignored) {
            // 다음 확인 때 다시 비교한다.
        }
    }

    private static String lessonLine(int period, int periodIndex, JSONObject match, boolean withTime) {
        StringBuilder line = new StringBuilder();
        line.append(period).append("교시");
        if (withTime && periodIndex < LocalTimetableRenderer.START_TIMES.length) {
            line.append(" ").append(LocalTimetableRenderer.START_TIMES[periodIndex]);
        }
        String className = match.optString("className");
        String title = match.optString("title");
        if (!className.isEmpty()) line.append(" ").append(className);
        if (!title.isEmpty()) line.append(" ").append(title);
        String note = match.optString("note");
        if (!note.isEmpty()) line.append(" (").append(note).append(")");
        return line.toString();
    }

    private static String dayLabel(String iso, String weekday) {
        if (iso.length() < 10) return weekday;
        int month = Integer.parseInt(iso.substring(5, 7));
        int date = Integer.parseInt(iso.substring(8, 10));
        return month + "/" + date + "(" + weekday + ")";
    }

    private static String join(List<String> lines) {
        StringBuilder text = new StringBuilder();
        for (String line : lines) {
            if (text.length() > 0) text.append("\n");
            text.append(line);
        }
        return text.toString();
    }

    private static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_CHANGES, "교과 변경 알림", NotificationManager.IMPORTANCE_HIGH));
        manager.createNotificationChannel(new NotificationChannel(
            CHANNEL_DAILY, "일일 수업 알림", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private static void notify(Context context, String channel, int id, String title, String body) {
        if (Build.VERSION.SDK_INT >= 33
            && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ensureChannels(context);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(
            context, id, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String firstLine = body.contains("\n") ? body.substring(0, body.indexOf('\n')) : body;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(firstLine)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(content)
            .setAutoCancel(true)
            .setPriority(CHANNEL_CHANGES.equals(channel)
                ? NotificationCompat.PRIORITY_HIGH
                : NotificationCompat.PRIORITY_DEFAULT);
        NotificationManagerCompat.from(context).notify(id, builder.build());
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
