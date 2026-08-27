package kr.yjms.timetable.board;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * 칠판 전원을 내렸다 켜도 감시 서비스가 스스로 살아나게 한다.
 * 이게 없으면 매일 아침 누군가 앱을 한 번 열어야 알림이 온다.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
            && !"android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            return;
        }

        // 학급이 설정되기 전에는 무엇을 감시해야 할지 알 수 없다.
        if (!BoardPrefs.isConfigured(context)) return;

        ChangeWatcherService.start(context);
    }
}
