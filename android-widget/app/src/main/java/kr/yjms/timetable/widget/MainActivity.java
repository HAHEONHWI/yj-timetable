package kr.yjms.timetable.widget;

import android.app.Activity;
import android.app.DatePickerDialog;
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
import android.widget.CompoundButton;
import android.widget.DatePicker;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;
import java.util.TreeSet;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {

    private EditText editName;
    private CheckBox chkMon, chkTue, chkWed, chkThu, chkFri;
    private CheckBox chkGrade1, chkGrade2, chkGrade3;
    
    // 동적 과목 체크박스들을 얹어줄 컨테이너
    private LinearLayout layoutSubjectsContainer;
    
    private RadioGroup rgTheme;
    private RadioButton rbThemeDark, rbThemeLight;
    
    private Button btnSave;

    // 관리자 관련 컴포넌트
    private EditText editAdminPw;
    private Button btnAdminLogin;
    private TextView txtAdminStatus;
    private LinearLayout cardAdminChange;
    private LinearLayout cardAdminEvent;

    // 수업 변경 등록 컴포넌트
    private EditText editChangeDate;
    private Spinner spnChangeClass;
    private Spinner spnChangePeriod;
    private EditText editChangeSubject;
    private Button btnAddChange;

    // 학교 행사 등록 컴포넌트
    private EditText editEventDate;
    private Spinner spnEventStart;
    private Spinner spnEventEnd;
    private EditText editEventTitle;
    private EditText editEventDesc;
    
    // 행사 적용 대상 체크박스
    private CheckBox chkEvClassAll;
    private CheckBox[] chkEvClasses = new CheckBox[6];
    private final String[] classNames = {"1-1", "1-2", "2-1", "2-2", "3-1", "3-2"};
    
    private Button btnAddEvent;

    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static final String SUPABASE_URL = "https://jzcectvzwbfvbgiszjkt.supabase.co";
    private static final String SUPABASE_KEY = "sb_publishable_JgPxLeD5pJjk46GnS-n3ZQ_gzZmIIuq";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // 이름 입력란 매핑
        editName = (EditText) findViewById(R.id.edit_name_native);

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

        // 동적 과목 컨테이너 매핑
        layoutSubjectsContainer = (LinearLayout) findViewById(R.id.layout_subjects_container);

        // 테마 라디오 매핑
        rgTheme = (RadioGroup) findViewById(R.id.rg_theme);
        rbThemeDark = (RadioButton) findViewById(R.id.rb_theme_dark);
        rbThemeLight = (RadioButton) findViewById(R.id.rb_theme_light);

        btnSave = (Button) findViewById(R.id.btn_save_native);

        // 관리자 UI 매핑
        editAdminPw = (EditText) findViewById(R.id.edit_admin_pw);
        btnAdminLogin = (Button) findViewById(R.id.btn_admin_login);
        txtAdminStatus = (TextView) findViewById(R.id.txt_admin_status);
        cardAdminChange = (LinearLayout) findViewById(R.id.card_admin_change);
        cardAdminEvent = (LinearLayout) findViewById(R.id.card_admin_event);

        // 수업 변경 UI 매핑
        editChangeDate = (EditText) findViewById(R.id.edit_change_date);
        spnChangeClass = (Spinner) findViewById(R.id.spn_change_class);
        spnChangePeriod = (Spinner) findViewById(R.id.spn_change_period);
        editChangeSubject = (EditText) findViewById(R.id.edit_change_subject);
        btnAddChange = (Button) findViewById(R.id.btn_add_change);

        // 학교 행사 UI 매핑
        editEventDate = (EditText) findViewById(R.id.edit_event_date);
        spnEventStart = (Spinner) findViewById(R.id.spn_event_start);
        spnEventEnd = (Spinner) findViewById(R.id.spn_event_end);
        editEventTitle = (EditText) findViewById(R.id.edit_event_title);
        editEventDesc = (EditText) findViewById(R.id.edit_event_desc);
        
        // 행사 적용 대상 체크박스 매핑
        chkEvClassAll = (CheckBox) findViewById(R.id.chk_ev_class_all);
        chkEvClasses[0] = (CheckBox) findViewById(R.id.chk_ev_class_1_1);
        chkEvClasses[1] = (CheckBox) findViewById(R.id.chk_ev_class_1_2);
        chkEvClasses[2] = (CheckBox) findViewById(R.id.chk_ev_class_2_1);
        chkEvClasses[3] = (CheckBox) findViewById(R.id.chk_ev_class_2_2);
        chkEvClasses[4] = (CheckBox) findViewById(R.id.chk_ev_class_3_1);
        chkEvClasses[5] = (CheckBox) findViewById(R.id.chk_ev_class_3_2);

        btnAddEvent = (Button) findViewById(R.id.btn_add_event);

        // 스피너 커스텀 어댑터 바인딩
        android.widget.ArrayAdapter<CharSequence> classAdapter = android.widget.ArrayAdapter.createFromResource(
            this, R.array.array_classes, R.layout.spinner_item
        );
        classAdapter.setDropDownViewResource(R.layout.spinner_item);
        spnChangeClass.setAdapter(classAdapter);

        android.widget.ArrayAdapter<CharSequence> periodAdapter = android.widget.ArrayAdapter.createFromResource(
            this, R.array.array_periods, R.layout.spinner_item
        );
        periodAdapter.setDropDownViewResource(R.layout.spinner_item);
        spnChangePeriod.setAdapter(periodAdapter);
        spnEventStart.setAdapter(periodAdapter);
        spnEventEnd.setAdapter(periodAdapter);

        // 전체 학급 토글 체크 이벤트 연동
        chkEvClassAll.setOnCheckedChangeListener(new CompoundButton.OnCheckedChangeListener() {
            @Override
            public void onCheckedChanged(CompoundButton buttonView, boolean isChecked) {
                for (CheckBox chk : chkEvClasses) {
                    if (chk != null) chk.setChecked(isChecked);
                }
            }
        });

        // 기존 설정값 로드 및 UI 체크 셋팅
        loadSavedSettings();

        // 캐시된 시간표가 있다면 미리 동적 과목 체크박스 그리기
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        String cachedJson = prefs.getString("last_timetable_json", "");
        if (!cachedJson.isEmpty()) {
            buildDynamicSubjectCheckboxes(cachedJson);
        }

        // 앱 내부 시간표 조회 대시보드 갱신
        loadTimetableGrid();

        // 저장 버튼 이벤트
        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                saveSettings();
            }
        });

        // 관리자 로그인 버튼 이벤트
        btnAdminLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performAdminLogin();
            }
        });

        // 날짜 선택 DatePickerDialog 연동
        editChangeDate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showDatePicker(editChangeDate);
            }
        });

        editEventDate.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                showDatePicker(editEventDate);
            }
        });

        // 수업 변경 사항 등록 버튼 이벤트
        btnAddChange.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                submitClassChange();
            }
        });

        // 학교 행사 등록 버튼 이벤트
        btnAddEvent.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                submitSchoolEvent();
            }
        });

        // 기로그인된 관리자 비번 존재 시 패널 자동 노출
        checkAdminLoginState();
    }

    private void loadSavedSettings() {
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        
        // 이름 로드
        editName.setText(prefs.getString("name", "최세영"));

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

        // 테마 로드
        String theme = prefs.getString("widget_theme", "dark");
        if ("light".equals(theme)) {
            rbThemeLight.setChecked(true);
        } else {
            rbThemeDark.setChecked(true);
        }
    }

    // 기본시간표 데이터 캐시로부터 고유 개설 과목 목록을 추출하여 동적 체크박스로 구성하는 핵심 엔진
    private void buildDynamicSubjectCheckboxes(String jsonString) {
        if (jsonString == null || jsonString.isEmpty()) return;
        try {
            JSONObject root = new JSONObject(jsonString);
            JSONArray gridArr = root.getJSONArray("grid");
            
            // 중복 배제 가나다 오름차순 정렬용 TreeSet
            TreeSet<String> uniqueSubjects = new TreeSet<>();
            for (int d = 0; d < gridArr.length(); d++) {
                JSONArray dayRow = gridArr.optJSONArray(d);
                if (dayRow == null) continue;
                for (int p = 0; p < dayRow.length(); p++) {
                    JSONArray cellMatches = dayRow.optJSONArray(p);
                    if (cellMatches == null) continue;
                    for (int m = 0; m < cellMatches.length(); m++) {
                        JSONObject match = cellMatches.getJSONObject(m);
                        String title = match.getString("title");
                        if (title != null && !title.isEmpty() && !"-".equals(title)) {
                            uniqueSubjects.add(title);
                        }
                    }
                }
            }

            // 기존 체크박스 삭제 클리어
            layoutSubjectsContainer.removeAllViews();
            
            // 기존에 선택 및 저장되어 있었던 과목 목록 로드
            SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
            String savedSubjects = prefs.getString("subjects", "");
            
            // 과목 리스트 루프 돌며 동적 체크박스 생성
            for (final String subject : uniqueSubjects) {
                CheckBox chk = new CheckBox(this);
                chk.setText(subject);
                chk.setTextColor(0xFFF8FAFC);
                chk.setTextSize(13.5f);
                chk.setPadding(6, 10, 6, 10);
                
                // 콤마 구분값 내 존재 여부에 따라 자동 체크 상태 복원
                if (savedSubjects.contains(subject)) {
                    chk.setChecked(true);
                }
                
                layoutSubjectsContainer.addView(chk);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void saveSettings() {
        String name = editName.getText().toString().trim();
        if (name.isEmpty()) name = "최세영";

        // 요일 빌드
        List<String> selectedDays = new ArrayList<>();
        if (chkMon.isChecked()) selectedDays.add("mon");
        if (chkTue.isChecked()) selectedDays.add("tue");
        if (chkWed.isChecked()) selectedDays.add("wed");
        if (chkThu.isChecked()) selectedDays.add("thu");
        if (chkFri.isChecked()) selectedDays.add("fri");
        String daysStr = joinList(selectedDays, ",");

        // 동적으로 띄워진 체크박스들로부터 선택 과목명들을 정밀 수집
        List<String> selectedSubs = new ArrayList<>();
        int childCount = layoutSubjectsContainer.getChildCount();
        for (int i = 0; i < childCount; i++) {
            View child = layoutSubjectsContainer.getChildAt(i);
            if (child instanceof CheckBox) {
                CheckBox chk = (CheckBox) child;
                if (chk.isChecked()) {
                    selectedSubs.add(chk.getText().toString());
                }
            }
        }
        String subsStr = joinList(selectedSubs, ",");

        // 학년 빌드
        List<String> selectedGrades = new ArrayList<>();
        if (chkGrade1.isChecked()) selectedGrades.add("1");
        if (chkGrade2.isChecked()) selectedGrades.add("2");
        if (chkGrade3.isChecked()) selectedGrades.add("3");
        String gradeNums = joinList(selectedGrades, "|");

        StringBuilder gradesBuilder = new StringBuilder();
        if (!selectedGrades.isEmpty()) {
            for (int i = 0; i < selectedSubs.size(); i++) {
                if (i > 0) gradesBuilder.append(";");
                gradesBuilder.append(selectedSubs.get(i)).append(":").append(gradeNums);
            }
        }
        String gradesStr = gradesBuilder.toString();

        // 테마 확인
        String themeStr = rbThemeLight.isChecked() ? "light" : "dark";

        // SharedPreferences 저장
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("name", name);
        editor.putString("days", daysStr);
        editor.putString("subjects", subsStr);
        editor.putString("grades", gradesStr);
        editor.putString("widget_theme", themeStr);
        editor.apply();

        Toast.makeText(this, "설정이 저장되어 위젯에 자동 동기화되었습니다.", Toast.LENGTH_SHORT).show();

        // 위젯 강제 업데이트 브로드캐스트 전송
        Context context = getApplicationContext();
        Intent widgetIntent = new Intent(context, TimetableWidgetProvider.class);
        widgetIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        
        AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
        int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
        widgetIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        context.sendBroadcast(widgetIntent);

        // 시간표 텍스트 격자 리렌더링
        loadTimetableGrid();
    }

    private void checkAdminLoginState() {
        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        String savedPw = prefs.getString("admin_pw", "");
        if (!savedPw.isEmpty()) {
            txtAdminStatus.setText("관리자 권한 획득 성공 (수업 변경 및 행사 관리 가능)");
            txtAdminStatus.setTextColor(0xFF2DD4BF);
            cardAdminChange.setVisibility(View.VISIBLE);
            cardAdminEvent.setVisibility(View.VISIBLE);
        }
    }

    private void performAdminLogin() {
        final String pw = editAdminPw.getText().toString().trim();
        if (pw.isEmpty()) {
            Toast.makeText(this, "비밀번호를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        txtAdminStatus.setText("로그인 요청 중...");
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(SUPABASE_URL + "/functions/v1/admin-login");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("apikey", SUPABASE_KEY);
                    conn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);

                    JSONObject bodyObj = new JSONObject();
                    bodyObj.put("password", pw);

                    OutputStream os = conn.getOutputStream();
                    os.write(bodyObj.toString().getBytes("UTF-8"));
                    os.close();

                    int code = conn.getResponseCode();
                    if (code == HttpURLConnection.HTTP_OK) {
                        InputStream in = conn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();

                        JSONObject result = new JSONObject(out.toString("UTF-8"));
                        final boolean ok = result.optBoolean("ok", false);

                        mainHandler.post(new Runnable() {
                            @Override
                            public void run() {
                                if (ok) {
                                    SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
                                    prefs.edit().putString("admin_pw", pw).apply();

                                    txtAdminStatus.setText("관리자 권한 획득 성공 (수업 변경 및 행사 관리 가능)");
                                    txtAdminStatus.setTextColor(0xFF2DD4BF);
                                    cardAdminChange.setVisibility(View.VISIBLE);
                                    cardAdminEvent.setVisibility(View.VISIBLE);
                                    editAdminPw.setText("");
                                    Toast.makeText(MainActivity.this, "관리자 로그인 성공!", Toast.LENGTH_SHORT).show();
                                } else {
                                    txtAdminStatus.setText("비밀번호 불일치 (권한 없음)");
                                    txtAdminStatus.setTextColor(0xFFEF4444);
                                    cardAdminChange.setVisibility(View.GONE);
                                    cardAdminEvent.setVisibility(View.GONE);
                                    Toast.makeText(MainActivity.this, "비밀번호가 올바르지 않습니다.", Toast.LENGTH_SHORT).show();
                                }
                            }
                        });
                    }
                    conn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            txtAdminStatus.setText("로그인 연결 오류");
                            txtAdminStatus.setTextColor(0xFFEF4444);
                            Toast.makeText(MainActivity.this, "인터넷 연결을 확인하세요.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    private void showDatePicker(final EditText target) {
        Calendar cal = Calendar.getInstance();
        DatePickerDialog dialog = new DatePickerDialog(this, new DatePickerDialog.OnDateSetListener() {
            @Override
            public void onDateSet(DatePicker view, int year, int month, int dayOfMonth) {
                String formatted = String.format("%04d-%02d-%02d", year, month + 1, dayOfMonth);
                target.setText(formatted);
            }
        }, cal.get(Calendar.YEAR), cal.get(Calendar.MONTH), cal.get(Calendar.DAY_OF_MONTH));
        dialog.show();
    }

    private void submitClassChange() {
        final String date = editChangeDate.getText().toString().trim();
        final String className = spnChangeClass.getSelectedItem().toString();
        final int period = spnChangePeriod.getSelectedItemPosition() + 1;
        final String subject = editChangeSubject.getText().toString().trim();

        if (date.isEmpty() || subject.isEmpty()) {
            Toast.makeText(this, "모든 정보를 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        final String password = prefs.getString("admin_pw", "");
        if (password.isEmpty()) {
            Toast.makeText(this, "관리자 권한이 만료되었습니다. 다시 로그인하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        Toast.makeText(this, "수업 변경사항 데이터베이스 반영 중...", Toast.LENGTH_SHORT).show();

        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL getUrl = new URL(SUPABASE_URL + "/rest/v1/app_state?id=eq.main&select=data");
                    HttpURLConnection getConn = (HttpURLConnection) getUrl.openConnection();
                    getConn.setRequestMethod("GET");
                    getConn.setRequestProperty("apikey", SUPABASE_KEY);
                    getConn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                    getConn.connect();

                    if (getConn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        InputStream in = getConn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();

                        JSONArray rows = new JSONArray(out.toString("UTF-8"));
                        if (rows.length() > 0) {
                            JSONObject rootState = rows.getJSONObject(0).getJSONObject("data");
                            JSONObject changes = rootState.optJSONObject("changes");
                            if (changes == null) {
                                changes = new JSONObject();
                                rootState.put("changes", changes);
                            }

                            String key = date + "__" + className + "__" + period;
                            JSONObject changeNode = new JSONObject();
                            changeNode.put("date", date);
                            changeNode.put("className", className);
                            changeNode.put("period", String.valueOf(period));
                            changeNode.put("subject", subject);
                            changes.put(key, changeNode);

                            URL postUrl = new URL(SUPABASE_URL + "/functions/v1/save-state");
                            HttpURLConnection postConn = (HttpURLConnection) postUrl.openConnection();
                            postConn.setRequestMethod("POST");
                            postConn.setRequestProperty("apikey", SUPABASE_KEY);
                            postConn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                            postConn.setRequestProperty("Content-Type", "application/json");
                            postConn.setDoOutput(true);

                            JSONObject postBody = new JSONObject();
                            postBody.put("password", password);
                            postBody.put("state", rootState);

                            OutputStream os = postConn.getOutputStream();
                            os.write(postBody.toString().getBytes("UTF-8"));
                            os.close();

                            final int postCode = postConn.getResponseCode();
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    if (postCode == HttpURLConnection.HTTP_OK) {
                                        Toast.makeText(MainActivity.this, "수업 변경 등록이 완료되었습니다!", Toast.LENGTH_LONG).show();
                                        editChangeSubject.setText("");
                                        loadTimetableGrid();
                                        saveSettings();
                                    } else {
                                        Toast.makeText(MainActivity.this, "DB 저장 실패 (권한 에러)", Toast.LENGTH_SHORT).show();
                                    }
                                }
                            });
                            postConn.disconnect();
                        }
                    }
                    getConn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "DB 통신 중 오류가 발생했습니다.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    private void submitSchoolEvent() {
        final String date = editEventDate.getText().toString().trim();
        final int startPeriod = spnEventStart.getSelectedItemPosition() + 1;
        final int endPeriod = spnEventEnd.getSelectedItemPosition() + 1;
        final String title = editEventTitle.getText().toString().trim();
        final String desc = editEventDesc.getText().toString().trim();

        List<String> eventClasses = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            if (chkEvClasses[i] != null && chkEvClasses[i].isChecked()) {
                eventClasses.add(classNames[i]);
            }
        }

        if (eventClasses.isEmpty()) {
            for (String cn : classNames) {
                eventClasses.add(cn);
            }
        }

        if (date.isEmpty() || title.isEmpty()) {
            Toast.makeText(this, "날짜와 행사 제목을 입력하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        if (startPeriod > endPeriod) {
            Toast.makeText(this, "시작 교시가 종료 교시보다 클 수 없습니다.", Toast.LENGTH_SHORT).show();
            return;
        }

        SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        final String password = prefs.getString("admin_pw", "");
        if (password.isEmpty()) {
            Toast.makeText(this, "관리자 권한이 만료되었습니다. 다시 로그인하세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        Toast.makeText(this, "학교 행사 데이터베이스 반영 중...", Toast.LENGTH_SHORT).show();

        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    URL getUrl = new URL(SUPABASE_URL + "/rest/v1/app_state?id=eq.main&select=data");
                    HttpURLConnection getConn = (HttpURLConnection) getUrl.openConnection();
                    getConn.setRequestMethod("GET");
                    getConn.setRequestProperty("apikey", SUPABASE_KEY);
                    getConn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                    getConn.connect();

                    if (getConn.getResponseCode() == HttpURLConnection.HTTP_OK) {
                        InputStream in = getConn.getInputStream();
                        ByteArrayOutputStream out = new ByteArrayOutputStream();
                        byte[] buffer = new byte[1024];
                        int length;
                        while ((length = in.read(buffer)) != -1) {
                            out.write(buffer, 0, length);
                        }
                        in.close();

                        JSONArray rows = new JSONArray(out.toString("UTF-8"));
                        if (rows.length() > 0) {
                            JSONObject rootState = rows.getJSONObject(0).getJSONObject("data");
                            JSONArray events = rootState.optJSONArray("events");
                            if (events == null) {
                                events = new JSONArray();
                                rootState.put("events", events);
                            }

                            JSONObject eventObj = new JSONObject();
                            eventObj.put("id", UUID.randomUUID().toString());
                            eventObj.put("date", date);
                            eventObj.put("start", startPeriod);
                            eventObj.put("end", endPeriod);
                            eventObj.put("title", title);
                            eventObj.put("description", desc);
                            
                            JSONArray classesArr = new JSONArray();
                            for (String clsName : eventClasses) {
                                classesArr.put(clsName);
                            }
                            eventObj.put("classes", classesArr);
                            events.put(eventObj);

                            URL postUrl = new URL(SUPABASE_URL + "/functions/v1/save-state");
                            HttpURLConnection postConn = (HttpURLConnection) postUrl.openConnection();
                            postConn.setRequestMethod("POST");
                            postConn.setRequestProperty("apikey", SUPABASE_KEY);
                            postConn.setRequestProperty("Authorization", "Bearer " + SUPABASE_KEY);
                            postConn.setRequestProperty("Content-Type", "application/json");
                            postConn.setDoOutput(true);

                            JSONObject postBody = new JSONObject();
                            postBody.put("password", password);
                            postBody.put("state", rootState);

                            OutputStream os = postConn.getOutputStream();
                            os.write(postBody.toString().getBytes("UTF-8"));
                            os.close();

                            final int postCode = postConn.getResponseCode();
                            mainHandler.post(new Runnable() {
                                @Override
                                public void run() {
                                    if (postCode == HttpURLConnection.HTTP_OK) {
                                        Toast.makeText(MainActivity.this, "학교 행사가 등록되었습니다!", Toast.LENGTH_LONG).show();
                                        editEventTitle.setText("");
                                        editEventDesc.setText("");
                                        
                                        chkEvClassAll.setChecked(false);
                                        for (CheckBox chk : chkEvClasses) {
                                            if (chk != null) chk.setChecked(false);
                                        }

                                        loadTimetableGrid();
                                        saveSettings();
                                    } else {
                                        Toast.makeText(MainActivity.this, "행사 등록 실패 (암호 불일치)", Toast.LENGTH_SHORT).show();
                                    }
                                }
                            });
                            postConn.disconnect();
                        }
                    }
                    getConn.disconnect();
                } catch (Exception e) {
                    e.printStackTrace();
                    mainHandler.post(new Runnable() {
                        @Override
                        public void run() {
                            Toast.makeText(MainActivity.this, "DB 통신 중 오류가 발생했습니다.", Toast.LENGTH_SHORT).show();
                        }
                    });
                }
            }
        });
    }

    private void loadTimetableGrid() {
        executor.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    final SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
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
                                // 최신 시간표 JSON 데이터를 SharedPreferences 에 캐싱 보관
                                SharedPreferences.Editor editor = prefs.edit();
                                editor.putString("last_timetable_json", jsonString);
                                editor.apply();

                                // 동적 과목 체크박스 뷰들 새로 채우기
                                buildDynamicSubjectCheckboxes(jsonString);

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
                            cellView.setBackgroundColor(0xFF0A252B);
                            cellView.setTextColor(0xFF2DD4BF);
                        } else if ("change".equals(type)) {
                            cellView.setBackgroundColor(0xFF2B1B0A);
                            cellView.setTextColor(0xFFF59E0B);
                        } else if ("original".equals(type)) {
                            cellView.setBackgroundColor(0xFF171D26);
                            cellView.setTextColor(0xFF94A3B8);
                        } else {
                            cellView.setBackgroundColor(0xFF1E293B);
                            cellView.setTextColor(0xFFF8FAFC);
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
