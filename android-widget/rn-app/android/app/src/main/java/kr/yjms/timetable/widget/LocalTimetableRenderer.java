package kr.yjms.timetable.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.RectF;
import android.graphics.Typeface;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

public final class LocalTimetableRenderer {

    static final String[] START_TIMES = {
        "08:40", "09:35", "10:30", "11:25", "13:20", "14:15", "15:10", "16:05", "16:55"
    };
    private static final String[] END_TIMES = {
        "09:25", "10:20", "11:15", "12:10", "14:05", "15:00", "15:55", "16:45", "17:35"
    };

    private LocalTimetableRenderer() {}

    private static final class LessonRow {
        final int index;
        final int period;
        final String classes;
        final String type;

        LessonRow(int index, int period, String classes, String type) {
            this.index = index;
            this.period = period;
            this.classes = classes;
            this.type = type;
        }
    }

    private static final class Timeline {
        final List<LessonRow> lessons;
        final int activeIndex;
        final int firstRemainingIndex;
        final int nextLessonIndex;
        final String status;

        Timeline(List<LessonRow> lessons, int activeIndex, int firstRemainingIndex, int nextLessonIndex, String status) {
            this.lessons = lessons;
            this.activeIndex = activeIndex;
            this.firstRemainingIndex = firstRemainingIndex;
            this.nextLessonIndex = nextLessonIndex;
            this.status = status;
        }
    }

    private static final class Palette {
        int card;
        int border;
        int primary;
        int secondary;
        int muted;
        int divider;
        int accent;
        int change;
        int added;
        int event;
    }

    public static Bitmap drawTeacherWidget(Context context, String jsonString, int widthPx, int heightPx) {
        int width = Math.max(1, widthPx);
        int height = Math.max(1, heightPx);
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawColor(0x00000000, PorterDuff.Mode.CLEAR);

        float density = context.getResources().getDisplayMetrics().density;
        canvas.save();
        canvas.scale(density, density);
        float widthDp = width / density;
        float heightDp = height / density;

        SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        String theme = prefs.getString("widget_theme", "dark");
        String teacherName = prefs.getString("name", "최세영").trim();
        if (teacherName.isEmpty()) teacherName = "최세영";

        Palette palette = palette("light".equals(theme));
        Timeline timeline = buildTimeline(jsonString);
        float inset = Math.min(3f, Math.max(1f, Math.min(widthDp, heightDp) * 0.015f));
        RectF card = new RectF(inset, inset, widthDp - inset, heightDp - inset);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(palette.card);
        canvas.drawRoundRect(card, 18f, 18f, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1f);
        paint.setColor(palette.border);
        canvas.drawRoundRect(card, 18f, 18f, paint);
        paint.setStyle(Paint.Style.FILL);

        float horizontalPadding = Math.min(20f, Math.max(14f, widthDp * 0.055f));
        boolean showAgenda = heightDp >= 330f && heightDp / Math.max(widthDp, 1f) >= 0.62f;
        boolean showCompact = widthDp >= 220f && heightDp >= 125f;
        String title = "용정시간표 · " + teacherName;

        if (showAgenda) {
            drawExpanded(canvas, paint, card, title, timeline, palette, horizontalPadding);
        } else if (showCompact) {
            drawCompact(canvas, paint, card, title, timeline, palette, horizontalPadding);
        } else {
            drawSmall(canvas, paint, card, teacherName, timeline, palette, horizontalPadding);
        }

        canvas.restore();
        return bitmap;
    }

    private static Palette palette(boolean light) {
        Palette colors = new Palette();
        if (light) {
            colors.card = 0xFFF8F8FA;
            colors.border = 0xFFE0E1E5;
            colors.primary = 0xFF202127;
            colors.secondary = 0xFF777982;
            colors.muted = 0xFFAAABB1;
            colors.divider = 0xFFE3E4E8;
            colors.accent = 0xFF397FC0;
            colors.change = 0xFFB7852E;
            colors.added = 0xFFB85C5C;
            colors.event = 0xFF39866A;
        } else {
            colors.card = 0xFF1D1E23;
            colors.border = 0xFF303137;
            colors.primary = 0xFFF2F2F4;
            colors.secondary = 0xFFA0A1A8;
            colors.muted = 0xFF62646C;
            colors.divider = 0xFF303137;
            colors.accent = 0xFF5E9BD8;
            colors.change = 0xFFD5A64B;
            colors.added = 0xFFD07474;
            colors.event = 0xFF55A484;
        }
        return colors;
    }

    private static Timeline buildTimeline(String jsonString) {
        List<LessonRow> lessons = new ArrayList<>();
        int currentIndex = -1;
        int firstRemaining = 0;
        int nextLesson = -1;
        String status;

        try {
            if (jsonString != null && !jsonString.trim().isEmpty()) {
                JSONObject root = new JSONObject(jsonString);
                JSONArray days = root.optJSONArray("days");
                JSONArray grid = root.optJSONArray("grid");
                int todayIndex = findTodayIndex(days);
                if (todayIndex >= 0 && grid != null && todayIndex < grid.length()) {
                    JSONArray today = grid.optJSONArray(todayIndex);
                    JSONArray periods = root.optJSONArray("periods");
                    if (today != null) {
                        for (int i = 0; i < today.length(); i++) {
                            JSONArray matches = today.optJSONArray(i);
                            if (matches == null || matches.length() == 0) continue;

                            LinkedHashMap<String, String> classTypes = new LinkedHashMap<>();
                            for (int j = 0; j < matches.length(); j++) {
                                JSONObject match = matches.optJSONObject(j);
                                if (match == null) continue;
                                String className = match.optString("className", "").trim();
                                String type = match.optString("type", "base");
                                if (className.isEmpty() && "event".equals(type)) {
                                    String note = match.optString("note", "").trim();
                                    if (note.matches("\\d-\\d(?:\\s*,\\s*\\d-\\d)*")) className = note;
                                }
                                if (className.isEmpty()) continue;

                                String previousType = classTypes.get(className);
                                if (previousType == null || typePriority(type) > typePriority(previousType)) {
                                    classTypes.put(className, type);
                                }
                            }
                            if (classTypes.isEmpty()) continue;

                            StringBuilder classNames = new StringBuilder();
                            String rowType = "base";
                            for (String className : classTypes.keySet()) {
                                if (classNames.length() > 0) classNames.append(", ");
                                classNames.append(className);
                                String type = classTypes.get(className);
                                if (typePriority(type) > typePriority(rowType)) rowType = type;
                            }
                            int period = periods == null ? i + 1 : periods.optInt(i, i + 1);
                            lessons.add(new LessonRow(i, period, classNames.toString(), rowType));
                        }
                    }
                }
            }
        } catch (Exception ignored) {
            lessons.clear();
        }

        int now = kstMinutesNow();
        for (int i = 0; i < START_TIMES.length; i++) {
            int start = toMinutes(START_TIMES[i]);
            int end = toMinutes(END_TIMES[i]);
            if (now >= start && now <= end) {
                currentIndex = i;
                firstRemaining = i;
                break;
            }
            if (now > end) firstRemaining = i + 1;
        }

        if (currentIndex >= 0) {
            status = (currentIndex + 1) + "교시 진행 중";
            nextLesson = nextLessonAtOrAfter(lessons, currentIndex + 1);
        } else if (firstRemaining == 0) {
            status = "수업 전";
            nextLesson = nextLessonAtOrAfter(lessons, 0);
        } else if (firstRemaining >= START_TIMES.length) {
            status = "오늘 수업 종료";
        } else {
            status = "쉬는 시간";
            nextLesson = nextLessonAtOrAfter(lessons, firstRemaining);
        }

        return new Timeline(lessons, currentIndex, firstRemaining, nextLesson, status);
    }

    private static int findTodayIndex(JSONArray days) {
        if (days == null) return -1;
        SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd", Locale.KOREA);
        iso.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        String today = iso.format(Calendar.getInstance().getTime());
        for (int i = 0; i < days.length(); i++) {
            JSONObject day = days.optJSONObject(i);
            if (day != null && today.equals(day.optString("iso", ""))) return i;
        }
        return -1;
    }

    private static int kstMinutesNow() {
        SimpleDateFormat time = new SimpleDateFormat("HH:mm", Locale.US);
        time.setTimeZone(TimeZone.getTimeZone("Asia/Seoul"));
        return toMinutes(time.format(Calendar.getInstance().getTime()));
    }

    private static int toMinutes(String time) {
        String[] parts = time.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    private static int nextLessonAtOrAfter(List<LessonRow> lessons, int startIndex) {
        for (LessonRow lesson : lessons) {
            if (lesson.index >= startIndex) return lesson.index;
        }
        return -1;
    }

    private static int typePriority(String type) {
        if ("new".equals(type)) return 4;
        if ("change".equals(type)) return 3;
        if ("event".equals(type)) return 2;
        if ("original".equals(type)) return 1;
        return 0;
    }

    private static void drawCompact(
        Canvas canvas,
        Paint paint,
        RectF card,
        String title,
        Timeline timeline,
        Palette colors,
        float padding
    ) {
        float width = card.width();
        float top = card.top;
        float bottom = card.bottom;
        float headerY = top + Math.min(22f, card.height() * 0.2f);
        float labelY = top + Math.min(44f, card.height() * 0.4f);
        float titleY = top + Math.min(67f, card.height() * 0.61f);
        float timeY = top + Math.min(88f, card.height() * 0.81f);
        float footerY = bottom - Math.min(12f, card.height() * 0.13f);

        drawHeader(canvas, paint, title, timeline.status, card.left + padding, card.right - padding, headerY, colors);
        drawFittedText(canvas, "다음 수업", card.left + padding, labelY, width - padding * 2f, 13f, 11f, colors.secondary, Paint.Align.LEFT, false, paint);

        LessonRow next = lessonAt(timeline.lessons, timeline.nextLessonIndex);
        String mainText = next == null ? (timeline.lessons.isEmpty() ? "오늘 수업 없음" : "오늘 수업 끝")
            : next.period + "교시 · " + next.classes;
        String timeText = next == null ? "예정된 수업이 없습니다"
            : START_TIMES[next.index] + "–" + END_TIMES[next.index];
        drawFittedText(canvas, mainText, card.left + padding, titleY, width - padding * 2f, 25f, 16f, colors.primary, Paint.Align.LEFT, true, paint);
        drawFittedText(canvas, timeText, card.left + padding, timeY, width - padding * 2f, 15f, 11f, colors.secondary, Paint.Align.LEFT, false, paint);

        drawFooter(canvas, paint, card, timeline, colors, padding, footerY);
    }

    private static void drawSmall(
        Canvas canvas,
        Paint paint,
        RectF card,
        String teacherName,
        Timeline timeline,
        Palette colors,
        float padding
    ) {
        float width = card.width();
        float headerY = card.top + Math.min(18f, card.height() * 0.32f);
        float titleY = card.top + Math.min(42f, card.height() * 0.74f);
        LessonRow next = lessonAt(timeline.lessons, timeline.nextLessonIndex);
        String header = next == null
            ? teacherName + " · 오늘"
            : teacherName + " · 다음 " + next.period + "교시";
        String title = next == null
            ? (timeline.lessons.isEmpty() ? "오늘 수업 없음" : "오늘 수업 끝")
            : next.classes;

        drawFittedText(canvas, header, card.left + padding, headerY, width - padding * 2f, 11f, 7f, colors.secondary, Paint.Align.LEFT, false, paint);
        drawFittedText(canvas, title, card.left + padding, titleY, width - padding * 2f, 17f, 10f, colors.primary, Paint.Align.LEFT, true, paint);
    }

    private static void drawExpanded(
        Canvas canvas,
        Paint paint,
        RectF card,
        String title,
        Timeline timeline,
        Palette colors,
        float padding
    ) {
        boolean dense = timeline.lessons.size() > 5;
        float top = card.top;
        float width = card.width();
        float headerY = top + 22f;
        float labelY = top + (dense ? 40f : 48f);
        float titleY = top + (dense ? 63f : 76f);
        float timeY = top + (dense ? 81f : 98f);
        float dividerY = top + (dense ? 91f : 110f);
        float listTop = dividerY + 5f;
        float footerY = card.bottom - 12f;

        drawHeader(canvas, paint, title, timeline.status, card.left + padding, card.right - padding, headerY, colors);

        LessonRow next = lessonAt(timeline.lessons, timeline.nextLessonIndex);
        String mainText = next == null ? (timeline.lessons.isEmpty() ? "오늘 수업 없음" : "오늘 수업 끝")
            : next.period + "교시 · " + next.classes;
        String timeText = next == null ? "예정된 수업이 없습니다"
            : START_TIMES[next.index] + "–" + END_TIMES[next.index];
        drawFittedText(canvas, "다음 수업", card.left + padding, labelY, width - padding * 2f, 13f, 11f, colors.secondary, Paint.Align.LEFT, false, paint);
        drawFittedText(canvas, mainText, card.left + padding, titleY, width - padding * 2f, dense ? 21f : 25f, 15f, colors.primary, Paint.Align.LEFT, true, paint);
        drawFittedText(canvas, timeText, card.left + padding, timeY, width - padding * 2f, 15f, 11f, colors.secondary, Paint.Align.LEFT, false, paint);

        paint.setStyle(Paint.Style.FILL);
        paint.setColor(colors.divider);
        canvas.drawRect(card.left + padding, dividerY, card.right - padding, dividerY + 1f, paint);

        if (!timeline.lessons.isEmpty()) {
            float availableHeight = Math.max(1f, footerY - listTop - 7f);
            float rowHeight = availableHeight / timeline.lessons.size();
            for (int i = 0; i < timeline.lessons.size(); i++) {
                LessonRow lesson = timeline.lessons.get(i);
                float rowTop = listTop + i * rowHeight;
                float centerY = rowTop + rowHeight / 2f;
                boolean current = lesson.index == timeline.activeIndex;
                boolean past = lesson.index < timeline.firstRemainingIndex && !current;
                int textColor = past ? colors.muted : colors.primary;
                int periodColor = past ? colors.muted : colors.secondary;
                float textSize = Math.max(9f, Math.min(15f, rowHeight * 0.55f));

                if (i > 0) {
                    paint.setColor(colors.divider);
                    canvas.drawRect(card.left + padding + 6f, rowTop, card.right - padding, rowTop + 0.7f, paint);
                }

                int markerColor = current ? colors.accent : typeColor(lesson.type, colors);
                if (current || !"base".equals(lesson.type)) {
                    paint.setColor(markerColor);
                    canvas.drawRect(card.left + padding, rowTop + 2f, card.left + padding + (current ? 2.5f : 2f), rowTop + rowHeight - 2f, paint);
                }

                float periodX = card.left + padding + 9f;
                float classX = card.left + padding + Math.min(72f, Math.max(50f, width * 0.19f));
                float timeX = card.right - padding - 2f;
                float timeWidth = Math.min(54f, width * 0.19f);
                drawFittedText(canvas, lesson.period + "교시", periodX, centerY + textSize * 0.34f, classX - periodX - 7f, textSize, 8f, periodColor, Paint.Align.LEFT, false, paint);
                drawFittedText(canvas, lesson.classes, classX, centerY + textSize * 0.34f, timeX - classX - timeWidth, textSize, 8f, textColor, Paint.Align.LEFT, true, paint);
                drawFittedText(canvas, START_TIMES[lesson.index], timeX, centerY + textSize * 0.34f, timeWidth, textSize, 8f, periodColor, Paint.Align.RIGHT, false, paint);
            }
        } else {
            drawFittedText(canvas, "오늘 수업이 없습니다", card.left + padding, listTop + 18f, width - padding * 2f, 14f, 11f, colors.secondary, Paint.Align.LEFT, false, paint);
        }

        drawFooter(canvas, paint, card, timeline, colors, padding, footerY);
    }

    private static void drawHeader(
        Canvas canvas,
        Paint paint,
        String title,
        String status,
        float left,
        float right,
        float baseline,
        Palette colors
    ) {
        paint.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        paint.setTextSize(13f);
        paint.setTextAlign(Paint.Align.RIGHT);
        float statusWidth = Math.min(right - left - 10f, paint.measureText(status));
        float titleWidth = Math.max(20f, right - left - statusWidth - 12f);
        drawFittedText(canvas, title, left, baseline, titleWidth, 13f, 9f, colors.secondary, Paint.Align.LEFT, true, paint);
        drawFittedText(canvas, status, right, baseline, statusWidth, 13f, 9f, colors.accent, Paint.Align.RIGHT, false, paint);
    }

    private static void drawFooter(
        Canvas canvas,
        Paint paint,
        RectF card,
        Timeline timeline,
        Palette colors,
        float padding,
        float baseline
    ) {
        int remaining = 0;
        for (LessonRow lesson : timeline.lessons) {
            if (lesson.index >= timeline.firstRemainingIndex) remaining++;
        }
        String summary = "남은 수업 " + remaining + "개 · 오늘 " + timeline.lessons.size() + "개";
        drawFittedText(
            canvas,
            summary,
            card.left + padding,
            baseline,
            card.width() - padding * 2f,
            12f,
            8f,
            colors.secondary,
            Paint.Align.LEFT,
            false,
            paint
        );
    }

    private static void drawFittedText(
        Canvas canvas,
        String text,
        float x,
        float baseline,
        float maxWidth,
        float textSize,
        float minTextSize,
        int color,
        Paint.Align align,
        boolean bold,
        Paint paint
    ) {
        if (text == null || text.isEmpty() || maxWidth <= 0f) return;
        paint.setStyle(Paint.Style.FILL);
        paint.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        paint.setTextAlign(align);
        paint.setColor(color);
        float size = textSize;
        paint.setTextSize(size);
        while (paint.measureText(text) > maxWidth && size > minTextSize) {
            size -= 0.5f;
            paint.setTextSize(size);
        }

        String visibleText = text;
        if (paint.measureText(visibleText) > maxWidth) {
            while (visibleText.length() > 1 && paint.measureText(visibleText + "…") > maxWidth) {
                visibleText = visibleText.substring(0, visibleText.length() - 1);
            }
            visibleText += "…";
        }
        canvas.drawText(visibleText, x, baseline, paint);
    }

    private static LessonRow lessonAt(List<LessonRow> lessons, int index) {
        if (index < 0) return null;
        for (LessonRow lesson : lessons) {
            if (lesson.index == index) return lesson;
        }
        return null;
    }

    private static int typeColor(String type, Palette colors) {
        if ("new".equals(type)) return colors.added;
        if ("change".equals(type)) return colors.change;
        if ("event".equals(type)) return colors.event;
        return colors.divider;
    }
}
