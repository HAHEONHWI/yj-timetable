package kr.yjms.timetable.widget;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

public class MainActivity extends Activity {

    private EditText editName;
    private EditText editSubjects;
    private EditText editGrades;
    private EditText editDays;
    private Button btnSave;
    private TextView txtCopyright;


    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        editName = (EditText) findViewById(R.id.edit_name);
        editSubjects = (EditText) findViewById(R.id.edit_subjects);
        editGrades = (EditText) findViewById(R.id.edit_grades);
        editDays = (EditText) findViewById(R.id.edit_days);
        btnSave = (Button) findViewById(R.id.btn_save);
        txtCopyright = (TextView) findViewById(R.id.txt_copyright);

        final SharedPreferences prefs = getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        
        // 기존 설정 값 불러오기
        editName.setText(prefs.getString("name", ""));
        editSubjects.setText(prefs.getString("subjects", ""));
        editGrades.setText(prefs.getString("grades", ""));
        editDays.setText(prefs.getString("days", "mon,tue,wed,thu,fri"));

        btnSave.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String name = editName.getText().toString().trim();
                String subjects = editSubjects.getText().toString().trim();
                String grades = editGrades.getText().toString().trim();
                String days = editDays.getText().toString().trim();

                // 설정 저장
                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("name", name);
                editor.putString("subjects", subjects);
                editor.putString("grades", grades);
                editor.putString("days", days);
                editor.apply();

                Toast.makeText(MainActivity.this, "설정이 저장되었습니다. 위젯 갱신을 시작합니다.", Toast.LENGTH_SHORT).show();

                // 바탕화면 위젯 강제 업데이트 브로드캐스트 방송 송출
                Context context = getApplicationContext();
                Intent intent = new Intent(context, TimetableWidgetProvider.class);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                
                AppWidgetManager widgetManager = AppWidgetManager.getInstance(context);
                int[] ids = widgetManager.getAppWidgetIds(new ComponentName(context, TimetableWidgetProvider.class));
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(intent);

                finish();
            }
        });
    }
}
