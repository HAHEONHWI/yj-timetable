package kr.yjms.timetable.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {

    private CheckBox chkMon, chkTue, chkWed, chkThu, chkFri;
    private CheckBox chkGrade1, chkGrade2, chkGrade3;
    private CheckBox chkSubEng, chkSubMath, chkSubKor, chkSubSci, chkSubSoc, chkSubHis, chkSubPe, chkSubMus;
    private Button btnSave;

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 요일 체크박스 매핑
        chkMon = (CheckBox) findViewById(R.id.chk_mon);
        chkTue = (CheckBox) findViewById(R.id.chk_tue);
        chkWed = (CheckBox) findViewById(R.id.chk_wed);
        chkThu = (CheckBox) findViewById(R.id.chk_thu);
        chkFri = (CheckBox) findViewById(R.id.chk_fri);

        // 학년 체크박스 매핑
        chkGrade1 = (CheckBox) findViewById(R.id.chk_grade_1);
        chkGrade2 = (CheckBox) findViewById(R.id.chk_grade_2);
        chkGrade3 = (CheckBox) findViewById(R.id.chk_grade_3);

        // 과목 체크박스 매핑
        chkSubEng = (CheckBox) findViewById(R.id.chk_sub_eng);
        chkSubMath = (CheckBox) findViewById(R.id.chk_sub_math);
        chkSubKor = (CheckBox) findViewById(R.id.chk_sub_kor);
        chkSubSci = (CheckBox) findViewById(R.id.chk_sub_sci);
        chkSubSoc = (CheckBox) findViewById(R.id.chk_sub_soc);
        chkSubHis = (CheckBox) findViewById(R.id.chk_sub_his);
        chkSubPe = (CheckBox) findViewById(R.id.chk_sub_pe);
        chkSubMus = (CheckBox) findViewById(R.id.chk_sub_mus);

        btnSave = (Button) findViewById(R.id.btn_save_native);

        // 기존 설정값 로드 및 UI 체크 셋팅
        loadSavedSettings();

        // 앱 내부 시간표 조회 대시보드 갱신
        loadTimetableGrid();

        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveSettings();
            }
        });
    }

    private void loadSavedSettings() {
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        
        // 요일 체크 셋팅
        String days = prefs.getString("days", "mon,tue,wed,thu,fri");
        chkMon.setChecked(days.contains("mon"));
        chkTue.setChecked(days.contains("tue"));
        chkWed.setChecked(days.contains("wed"));
        chkThu.setChecked(days.contains("thu"));
        chkFri.setChecked(days.contains("fri"));

        // 학년 체크 셋팅
        String grades = prefs.getString("grades", "");
        chkGrade1.setChecked(grades.contains("1"));
        chkGrade2.setChecked(grades.contains("2"));
        chkGrade3.setChecked(grades.contains("3"));

        // 과목 체크 셋팅
        String subjects = prefs.getString("subjects", "");
        chkSubEng.setChecked(subjects.contains("영어"));
        chkSubMath.setChecked(subjects.contains("수학"));
        chkSubKor.setChecked(subjects.contains("국어"));
        chkSubSci.setChecked(subjects.contains("과학"));
        chkSubSoc.setChecked(subjects.contains("사회"));
        chkSubHis.setChecked(subjects.contains("역사"));
        chkSubPe.setChecked(subjects.contains("체육"));
        chkSubMus.setChecked(subjects.contains("음악"));
    }

    private void saveSettings() {
        // 1. 선택된 요일 빌드
        List<String> selectedDays = new ArrayList<>();
        if (chkMon.isChecked()) selectedDays.add("mon");
        if (chkTue.isChecked()) selectedDays.add("tue");
        if (chkWed.isChecked()) selectedDays.add("wed");
        if (chkThu.isChecked()) selectedDays.add("thu");
        if (chkFri.isChecked()) selectedDays.add("fri");
        String daysStr = joinList(selectedDays, ",");

        // 2. 선택된 과목 빌드
        List<String> selectedSubs = new ArrayList<>();
        if (chkSubEng.isChecked()) selectedSubs.add("영어");
        if (chkSubMath.isChecked()) selectedSubs.add("수학");
        if (chkSubKor.isChecked()) selectedSubs.add("국어");
        if (chkSubSci.isChecked()) selectedSubs.add("과학");
        if (chkSubSoc.isChecked()) selectedSubs.add("사회");
        if (chkSubHis.isChecked()) selectedSubs.add("역사");
        if (chkSubPe.isChecked()) selectedSubs.add("체육");
        if (chkSubMus.isChecked()) selectedSubs.add("음악");
        String subsStr = joinList(selectedSubs, ",");

        // 3. 선택된 학년 빌드
        List<String> selectedGrades = new ArrayList<>();
        if (chkGrade1.isChecked()) selectedGrades.add("1");
        if (chkGrade2.isChecked()) selectedGrades.add("2");
        if (chkGrade3.isChecked()) selectedGrades.add("3");
        String gradeNums = joinList(selectedGrades, "|");

        // 과목과 학년 조합하여 포맷팅 (예: 영어:1|2;수학:1|2)
        StringBuilder gradesBuilder = new StringBuilder();
        if (!selectedGrades.isEmpty()) {
            for (int i = 0; i < selectedSubs.size(); i++) {
                if (i > 0) gradesBuilder.append(";");
                gradesBuilder.append(selectedSubs.get(i)).append(":").append(gradeNums);
            }
        }
        String gradesStr = gradesBuilder.toString();

        // 4. SharedPreferences에 안전하게 저장
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("days", daysStr);
        editor.putString("subjects", subsStr);
        editor.putString("grades", gradesStr);
        editor.apply();

        Toast.makeText(this, "설정이 저장되어 위젯에 자동 동기화되었습니다.", Toast.LENGTH_SHORT).show();

        // 5. 바탕화면 위젯 강제 업데이트 브로드캐스트 전송
        Context context = getApplicationContext();
        Intent widgetIntent = new Intent(context, TimetableWidgetProvider.class);
        widgetIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        
        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
        int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
        widgetIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(widgetIntent);

        // 6. 앱 내부 시간표 조회 격자 리렌더링
        loadTimetableGrid();
    }

    private void loadTimetableGrid() {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
                    String name = prefs.getString("name", "최세영");
                    String subjects = prefs.getString("subjects", "");
                    String grades = prefs.getString("grades", "");
                    String days = prefs.getString("days", "mon,tue,wed,thu,fri");

                    StringBuilder urlBuilder = new StringBuilder("https://schedule.yjms.kr/wallpaper.png?format=json");
                    urlBuilder.append("&name=").append(URLEncoder.encode(name, "UTF-8"));
                    urlBuilder.append("&subjects=").append(URLEncoder.encode(subjects, "UTF-8"));
                    urlBuilder.append("&grades=").append(URLEncoder.encode(grades, "UTF-8"));
                    urlBuilder.append("&days=").append(URLEncoder.encode(days, "UTF-8"));
                    urlBuilder.append("&v=").append(System.currentTimeMillis());

                    URL url = new URL(urlBuilder.toString());
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setConnectTimeout(8000);
                    conn.setReadTimeout(8000);
                    conn.connect();

                    if (conn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        InputStream in = conn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();
                        
                        final String jsonString = out.toString("UTF-8");
                        
                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                updateAppGrid(jsonString);
                            }
                        });
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        });
    }

    private void updateAppGrid(String jsonString) {
        try {
            JSONObject root = new JSONObject(jsonString);
            JSONArray gridArr = root.getJSONArray("grid");
            
            for (int d = 0; d < 5; d++) {
                JSONArray dayRow = gridArr.optJSONArray(d);
                for (int p = 0; p < 9; p++) {
                    int viewId = getResources().getIdentifier("app_cell_" + d + "_" + p, "id", getPackageName());
                    if (viewId == 0) continue;

                    TextView cellView = (TextView) findViewById(viewId);
                    if (cellView == null) continue;

                    JSONArray cellMatches = (dayRow != null) ? dayRow.optJSONArray(p) : null;
                    if (cellMatches != null && cellMatches.length() > 0) {
                        JSONObject match = cellMatches.getJSONObject(0);
                        String title = match.getString("title");
                        String note = match.optString("note", "");
                        String type = match.optString("type", "");

                        String dispText = title;
                        if (note != null && !note.isEmpty()) {
                            dispText = title + "\n" + note;
                        }
                        
                        cellView.setText(dispText);
                        
                        // 타입별 다크 테마 배경 및 텍스트 도색
                        if ("event".equals(type)) {
                            cellView.setBackgroundColor(0xFF0A252B); // 민트 어두움
                            cellView.setTextColor(0xFF2DD4BF); // 민트 텍스트
                        } else if ("change".equals(type)) {
                            cellView.setBackgroundColor(0xFF2B1B0A); // 오렌지 어두움
                            cellView.setTextColor(0xFFF59E0B); // 오렌지 텍스트
                        } else if ("original".equals(type)) {
                            cellView.setBackgroundColor(0xFF171D26); // 회색 어두움
                            cellView.setTextColor(0xFF94A3B8); // 회색 텍스트
                        } else {
                            cellView.setBackgroundColor(0xFF1E293B); // 기본 남색
                            cellView.setTextColor(0xFFF8FAFC); // 기본 흰색
                        }
                    } else {
                        cellView.setText("");
                        cellView.setBackgroundColor(0xFF1E293B);
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String joinList(List<String> list, String delimiter) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(delimiter);
            sb.append(list.get(i));
        }
        return sb.toString();
    }
}
