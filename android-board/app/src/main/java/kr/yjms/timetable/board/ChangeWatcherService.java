package kr.yjms.timetable.board;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.TimeZone;

/**
 * 화면이 꺼져 있어도 교과 변경을 알리는 포그라운드 서비스.
 *
 * 이 칠판에는 Google Play 서비스가 없어 FCM 을 쓸 수 없다. 그래서 푸시 대신
 * Supabase REST 를 주기적으로 조회한다. 프레임워크 API 만 쓰므로 빌드에 의존성이 늘지 않는다.
 */
public class ChangeWatcherService extends Service {

    private static final String TAG = "BoardWatcher";

    private static final String STATE_URL =
        "https://jzcectvzwbfvbgiszjkt.supabase.co/rest/v1/app_state?id=eq.main&select=data";
    // 브라우저에 노출되는 공개 키다. service role key 가 아니다.
    private static final String ANON_KEY = "sb_publishable_JgPxLeD5pJjk46GnS-n3ZQ_gzZmIIuq";

    private static final long POLL_INTERVAL_MS = 60_000L;
    private static final int ONGOING_NOTIFICATION_ID = 1;
    private static final int CHANGE_NOTIFICATION_ID = 2;
    private static final int NOTICE_NOTIFICATION_ID = 3;
    private static final int STUDENT_CALL_NOTIFICATION_ID = 4;

    private static final String CHANNEL_ONGOING = "board-watch";
    private static final String CHANNEL_ALERT_SOUND = "board-change-sound";
    private static final String CHANNEL_ALERT_SILENT = "board-change-silent";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running = false;

    private final Runnable pollTask = new Runnable() {
        @Override
        public void run() {
            startPollThread();
            handler.postDelayed(this, POLL_INTERVAL_MS);
        }
    };

    static void start(Context context) {
        Intent intent = new Intent(context, ChangeWatcherService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        createChannels();
        startForeground(ONGOING_NOTIFICATION_ID, buildOngoingNotification());
        if (!running) {
            running = true;
            handler.post(pollTask);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(pollTask);
        running = false;
        super.onDestroy();
    }

    private void startPollThread() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    poll();
                } catch (Exception error) {
                    // 네트워크가 끊긴 아침 등 실패는 흔하다. 다음 주기에 다시 시도한다.
                    Log.w(TAG, "poll failed: " + error.getMessage());
                }
            }
        }).start();
    }

    private void poll() throws Exception {
        String className = BoardPrefs.className(this);
        if (className.length() == 0) return;

        JSONObject data = fetchState();
        if (data == null) return;

        JSONObject changes = data.optJSONObject("changes");
        if (changes == null) changes = new JSONObject();
        JSONArray notices = data.optJSONArray("notices");
        if (notices == null) notices = new JSONArray();

        processChanges(changes, className);
        processNotices(notices);
        processStudentCall(data.optJSONObject("studentCall"), className);
    }

    private void processStudentCall(JSONObject call, String className) {
        if (call == null) return;
        String callId = call.optString("id", "");
        String targetClass = call.optString("className", "");
        long expiresAtMs = parseUtc(call.optString("expiresAt", ""));
        if (!StudentCallPolicy.shouldNotify(
            className,
            targetClass,
            callId,
            BoardPrefs.studentCallId(this),
            expiresAtMs,
            System.currentTimeMillis()
        )) return;

        BoardPrefs.setStudentCallId(this, callId);
        if (MainActivity.isBoardVisible()) return;
        notifyStudentCall(call);
    }

    private long parseUtc(String value) {
        if (value == null || value.length() == 0) return 0L;
        try {
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
            format.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date parsed = format.parse(value);
            return parsed == null ? 0L : parsed.getTime();
        } catch (Exception error) {
            return 0L;
        }
    }

    private void processChanges(JSONObject changes, String className) {
        Map<String, String> current = collectChanges(changes, className);
        String snapshot = encode(current);
        String previousRaw = BoardPrefs.snapshot(this);
        boolean hasSnapshot = BoardPrefs.hasSnapshot(this);

        BoardPrefs.setSnapshot(this, snapshot);
        if (!NotificationDiff.shouldCompare(hasSnapshot, previousRaw, snapshot)) return;

        List<String> lines = describe(decode(previousRaw), current);
        if (lines.isEmpty()) return;

        // 칠판 화면이 켜져 있으면 웹 화면이 이미 배너로 알린다. 중복 알림을 막는다.
        if (MainActivity.isBoardVisible()) return;

        notifyChanges(className, lines);
    }

    private void processNotices(JSONArray notices) {
        Map<String, String> current = collectNotices(notices);
        String snapshot = encodeNotices(current);
        String previousRaw = BoardPrefs.noticeSnapshot(this);
        boolean hasSnapshot = BoardPrefs.hasNoticeSnapshot(this);

        BoardPrefs.setNoticeSnapshot(this, snapshot);
        if (!NotificationDiff.shouldCompare(hasSnapshot, previousRaw, snapshot)) return;

        Map<String, String> previous = decodeNotices(previousRaw);
        List<String> changedKeys = NotificationDiff.changedKeys(previous, current);
        if (changedKeys.isEmpty()) return;

        notifyNotices(changedKeys, current);
    }

    private JSONObject fetchState() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(STATE_URL).openConnection();
        try {
            connection.setRequestMethod("GET");
            connection.setRequestProperty("apikey", ANON_KEY);
            connection.setRequestProperty("Authorization", "Bearer " + ANON_KEY);
            connection.setRequestProperty("Accept", "application/json");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(15000);

            if (connection.getResponseCode() != 200) {
                Log.w(TAG, "unexpected status " + connection.getResponseCode());
                return null;
            }

            StringBuilder body = new StringBuilder();
            BufferedReader reader = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), "UTF-8")
            );
            try {
                String line;
                while ((line = reader.readLine()) != null) {
                    body.append(line);
                }
            } finally {
                reader.close();
            }

            JSONArray rows = new JSONArray(body.toString());
            if (rows.length() == 0) return null;
            return rows.getJSONObject(0).optJSONObject("data");
        } finally {
            connection.disconnect();
        }
    }

    /** 이 칠판 학급의 오늘 이후 변경만 모은다. 키는 "날짜__학급__교시". */
    private Map<String, String> collectChanges(JSONObject changes, String className) {
        Map<String, String> result = new TreeMap<String, String>();
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(new Date());

        Iterator<String> keys = changes.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            String[] parts = key.split("__");
            if (parts.length != 3) continue;
            if (!className.equals(parts[1])) continue;
            if (parts[0].compareTo(today) < 0) continue;

            JSONObject change = changes.optJSONObject(key);
            if (change == null) continue;

            result.put(key, change.optString("subject", "")
                + "|" + change.optString("memo", "")
                + "|" + change.optString("type", "swap"));
        }
        return result;
    }

    private Map<String, String> collectNotices(JSONArray notices) {
        Map<String, String> result = new TreeMap<String, String>();
        for (int index = 0; index < notices.length(); index++) {
            JSONObject notice = notices.optJSONObject(index);
            if (notice == null) continue;
            String title = notice.optString("title", "").trim();
            String body = notice.optString("body", "").trim();
            if (title.length() == 0 && body.length() == 0) continue;
            String id = notice.optString("id", "notice-" + index);
            result.put(id, title + '\u001f' + body);
        }
        return result;
    }

    private String encode(Map<String, String> values) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            if (builder.length() > 0) builder.append('\n');
            builder.append(entry.getKey()).append('=').append(entry.getValue());
        }
        return builder.toString();
    }

    private Map<String, String> decode(String raw) {
        Map<String, String> values = new TreeMap<String, String>();
        if (raw.length() == 0) return values;
        for (String line : raw.split("\n")) {
            int separator = line.indexOf('=');
            if (separator <= 0) continue;
            values.put(line.substring(0, separator), line.substring(separator + 1));
        }
        return values;
    }

    private String encodeNotices(Map<String, String> values) {
        JSONArray rows = new JSONArray();
        for (Map.Entry<String, String> entry : values.entrySet()) {
            JSONObject row = new JSONObject();
            try {
                row.put("id", entry.getKey());
                row.put("value", entry.getValue());
                rows.put(row);
            } catch (Exception error) {
                Log.w(TAG, "notice snapshot encode failed: " + error.getMessage());
            }
        }
        return rows.toString();
    }

    private Map<String, String> decodeNotices(String raw) {
        Map<String, String> values = new TreeMap<String, String>();
        if (raw.length() == 0) return values;
        try {
            JSONArray rows = new JSONArray(raw);
            for (int index = 0; index < rows.length(); index++) {
                JSONObject row = rows.optJSONObject(index);
                if (row == null) continue;
                values.put(row.optString("id", ""), row.optString("value", ""));
            }
        } catch (Exception error) {
            Log.w(TAG, "notice snapshot decode failed: " + error.getMessage());
        }
        return values;
    }

    private List<String> describe(Map<String, String> previous, Map<String, String> current) {
        List<String> lines = new ArrayList<String>();

        for (String key : NotificationDiff.changedKeys(previous, current)) {
            lines.add(line(key, current.get(key), false));
        }
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).format(new Date());
        for (String key : NotificationDiff.removedKeysOnOrAfter(previous, current, today)) {
            lines.add(line(key, previous.get(key), true));
        }
        return lines;
    }

    private String line(String key, String value, boolean removed) {
        String[] parts = key.split("__");
        String[] fields = value.split("\\|", -1);
        String subject = fields.length > 0 ? fields[0] : "";
        String memo = fields.length > 1 ? fields[1] : "";
        String type = fields.length > 2 ? fields[2] : "swap";

        String head = weekdayLabel(parts[0]) + "요일 " + parts[2] + "교시 · ";
        if (removed) {
            return head + subject + " 변경 취소";
        }

        String text = head + subject + ("new".equals(type) ? " 신설" : "");
        if (memo.length() > 0) {
            text = text + " · " + memo;
        }
        return text;
    }

    private String weekdayLabel(String isoDate) {
        try {
            Date date = new SimpleDateFormat("yyyy-MM-dd", Locale.KOREA).parse(isoDate);
            Calendar calendar = Calendar.getInstance(Locale.KOREA);
            calendar.setTime(date);
            String[] labels = {"일", "월", "화", "수", "목", "금", "토"};
            return labels[calendar.get(Calendar.DAY_OF_WEEK) - 1];
        } catch (Exception error) {
            return isoDate;
        }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel ongoing = new NotificationChannel(
            CHANNEL_ONGOING, "시간표 감시", NotificationManager.IMPORTANCE_LOW
        );
        ongoing.setDescription("화면이 꺼져 있어도 교과 변경, 공지, 학생 호출을 확인합니다.");
        manager.createNotificationChannel(ongoing);

        NotificationChannel withSound = new NotificationChannel(
            CHANNEL_ALERT_SOUND, "시간표 알림", NotificationManager.IMPORTANCE_HIGH
        );
        manager.createNotificationChannel(withSound);

        NotificationChannel silent = new NotificationChannel(
            CHANNEL_ALERT_SILENT, "시간표 알림 (무음)", NotificationManager.IMPORTANCE_HIGH
        );
        silent.setSound(null, null);
        manager.createNotificationChannel(silent);
    }

    private PendingIntent boardIntent() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags | PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, 0, intent, flags);
    }

    @SuppressWarnings("deprecation")
    private Notification buildOngoingNotification() {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ONGOING)
            : new Notification.Builder(this);

        return builder
            .setContentTitle("시간표 감시 중")
            .setContentText(BoardPrefs.className(this) + " 교과 변경, 공지, 학생 호출을 확인합니다.")
            .setSmallIcon(R.drawable.app_icon)
            .setContentIntent(boardIntent())
            .setOngoing(true)
            .build();
    }

    @SuppressWarnings("deprecation")
    private void notifyChanges(String className, List<String> lines) {
        boolean sound = BoardPrefs.soundEnabled(this);
        String channel = sound ? CHANNEL_ALERT_SOUND : CHANNEL_ALERT_SILENT;

        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, channel)
            : new Notification.Builder(this);

        StringBuilder body = new StringBuilder();
        for (String line : lines) {
            if (body.length() > 0) body.append('\n');
            body.append(line);
        }

        String title = lines.size() > 1
            ? className + " 교과 변경 " + lines.size() + "건"
            : className + " 교과 변경";

        builder.setContentTitle(title)
            .setContentText(lines.get(0))
            .setStyle(new Notification.BigTextStyle().bigText(body.toString()))
            .setSmallIcon(R.drawable.app_icon)
            .setContentIntent(boardIntent())
            .setAutoCancel(true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_HIGH);
            if (sound) {
                builder.setDefaults(Notification.DEFAULT_SOUND);
            }
        }

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(CHANGE_NOTIFICATION_ID, builder.build());
        }
    }

    @SuppressWarnings("deprecation")
    private void notifyNotices(List<String> changedKeys, Map<String, String> notices) {
        boolean sound = BoardPrefs.soundEnabled(this);
        String channel = sound ? CHANNEL_ALERT_SOUND : CHANNEL_ALERT_SILENT;
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, channel)
            : new Notification.Builder(this);

        List<String> lines = new ArrayList<String>();
        for (String key : changedKeys) {
            String[] fields = notices.get(key).split("\u001f", -1);
            String title = fields.length > 0 ? fields[0] : "";
            String body = fields.length > 1 ? fields[1] : "";
            lines.add(title.length() == 0 ? body : title + (body.length() == 0 ? "" : " · " + body));
        }

        StringBuilder body = new StringBuilder();
        for (String line : lines) {
            if (body.length() > 0) body.append('\n');
            body.append(line);
        }
        String title = lines.size() > 1 ? "학교 공지 " + lines.size() + "건" : "학교 공지";

        builder.setContentTitle(title)
            .setContentText(lines.get(0))
            .setStyle(new Notification.BigTextStyle().bigText(body.toString()))
            .setSmallIcon(R.drawable.app_icon)
            .setContentIntent(boardIntent())
            .setAutoCancel(true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_HIGH);
            if (sound) builder.setDefaults(Notification.DEFAULT_SOUND);
        }

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTICE_NOTIFICATION_ID, builder.build());
        }
    }

    @SuppressWarnings("deprecation")
    private void notifyStudentCall(JSONObject call) {
        boolean sound = BoardPrefs.soundEnabled(this);
        String channel = sound ? CHANNEL_ALERT_SOUND : CHANNEL_ALERT_SILENT;
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, channel)
            : new Notification.Builder(this);

        String studentName = call.optString("studentName", "학생").trim();
        String destination = call.optString("destination", "교무실").trim();
        String message = call.optString("message", "").trim();
        String body = destination + "로 와 주세요." + (message.length() == 0 ? "" : " " + message);

        builder.setContentTitle("학생 호출 · " + studentName)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.app_icon)
            .setContentIntent(boardIntent())
            .setAutoCancel(true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setPriority(Notification.PRIORITY_HIGH);
            if (sound) builder.setDefaults(Notification.DEFAULT_SOUND);
        }

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(STUDENT_CALL_NOTIFICATION_ID, builder.build());
        }
    }
}
