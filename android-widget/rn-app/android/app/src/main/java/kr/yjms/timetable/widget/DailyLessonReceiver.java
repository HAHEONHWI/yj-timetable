package kr.yjms.timetable.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 매일 오전 8시 알람. 다음 날 알람을 먼저 등록하고 오늘 수업 알림을 보낸다. */
public final class DailyLessonReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        final Context appContext = context.getApplicationContext();
        final PendingResult result = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    TeacherNotifications.applySchedules(appContext);
                    TeacherNotifications.sendDailyLessons(appContext);
                } finally {
                    result.finish();
                }
            }
        }).start();
    }
}
