package kr.yjms.timetable.widget;

import android.app.job.JobParameters;
import android.app.job.JobService;

/** 한 시간마다 교사 시간표를 받아 새 교과 변경이 있으면 알린다. */
public final class ChangeCheckJobService extends JobService {

    @Override
    public boolean onStartJob(final JobParameters params) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                TeacherNotifications.checkChanges(getApplicationContext());
                jobFinished(params, false);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }
}
