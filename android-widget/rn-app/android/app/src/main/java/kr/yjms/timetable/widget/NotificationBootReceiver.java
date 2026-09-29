package kr.yjms.timetable.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** 재부팅, 앱 업데이트, 시간 변경 후 아침 알람을 다시 등록한다. */
public final class NotificationBootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        TeacherNotifications.applySchedules(context.getApplicationContext());
    }
}
