package kr.yjms.timetable.widget;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import org.json.JSONArray;
import org.json.JSONObject;

public class LocalTimetableRenderer {

    public static Bitmap drawTimetable(Context context, String jsonString) {
        // 1. 고화질 드로잉 비트맵 생성 (위젯 가로세로 매칭 비율 1200 x 1000)
        Bitmap bitmap = Bitmap.createBitmap(1200, 1000, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // 2. 브러시 및 페인트 설정
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);

        // 3. 배경색 채우기 (#0f172a)
        paint.setColor(0xFF0F172A);
        canvas.drawRect(0, 0, 1200, 1000, paint);

        try {
            JSONObject root = new JSONObject(jsonString);
            JSONArray gridArr = root.getJSONArray("grid");

            // 격자 오프셋 산정
            float leftMargin = 120f;
            float topMargin = 100f;
            float gridWidth = 1200f - leftMargin;
            float gridHeight = 1000f - topMargin;
            float colWidth = gridWidth / 5f;
            float rowHeight = gridHeight / 9f;

            // 4. 격자선 도색 (#1e293b)
            paint.setColor(0xFF1E293B);
            paint.setStrokeWidth(2f);
            paint.setStyle(Paint.Style.STROKE);
            
            // 세로선 그리기
            for (int i = 0; i <= 5; i++) {
                float x = leftMargin + i * colWidth;
                canvas.drawLine(x, 0, x, 1000, paint);
            }
            // 가로선 그리기
            for (int i = 0; i <= 9; i++) {
                float y = topMargin + i * rowHeight;
                canvas.drawLine(0, y, 1200, y, paint);
            }

            // 5. 헤더 텍스트 드로잉 (요일 및 교시 라벨)
            paint.setStyle(Paint.Style.FILL);
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));

            // 요일 그리기
            paint.setColor(0xFFF8FAFC); // 흰색
            paint.setTextSize(32f);
            String[] dayLabels = {"월", "화", "수", "목", "금"};
            for (int i = 0; i < 5; i++) {
                float x = leftMargin + i * colWidth + (colWidth / 2f);
                float y = topMargin / 2f + 12f; // 요일 세로 중앙
                canvas.drawText(dayLabels[i], x, y, paint);
            }

            // 교시 그리기
            paint.setColor(0xFF94A3B8); // 회색
            paint.setTextSize(30f);
            for (int i = 0; i < 9; i++) {
                float x = leftMargin / 2f;
                float y = topMargin + i * rowHeight + (rowHeight / 2f) + 10f; // 교시 세로 중앙
                canvas.drawText(String.valueOf(i + 1), x, y, paint);
            }

            // 6. 2차원 시간표 셀 병합 렌더링 (디자인 100% 복제 구현)
            boolean[][] visited = new boolean[5][9];

            for (int d = 0; d < 5; d++) {
                JSONArray dayRow = gridArr.optJSONArray(d);
                if (dayRow == null) continue;

                for (int p = 0; p < 9; p++) {
                    if (visited[d][p]) continue;

                    JSONArray cellMatches = dayRow.optJSONArray(p);
                    if (cellMatches == null || cellMatches.length() == 0) continue;

                    JSONObject match = cellMatches.getJSONObject(0);
                    String title = match.getString("title");
                    String note = match.optString("note", "");
                    String type = match.optString("type", "");

                    // 연속된 세로 교시 병합(rowspan) 감지
                    int spanRows = 1;
                    for (int p2 = p + 1; p2 < 9; p2++) {
                        JSONArray nextMatches = dayRow.optJSONArray(p2);
                        if (nextMatches == null || nextMatches.length() == 0) break;
                        JSONObject nextMatch = nextMatches.getJSONObject(0);
                        
                        // 과목명, 분류타입, 세부설명이 일치하면 병합 처리
                        if (title.equals(nextMatch.getString("title")) &&
                            type.equals(nextMatch.optString("type", "")) &&
                            note.equals(nextMatch.optString("note", ""))) {
                            spanRows++;
                        } else {
                            break;
                        }
                    }

                    // 칩 RectF 영역 계산
                    float left = leftMargin + d * colWidth + 6f;
                    float top = topMargin + p * rowHeight + 6f;
                    float right = leftMargin + (d + 1) * colWidth - 6f;
                    float bottom = topMargin + (p + spanRows) * rowHeight - 6f;
                    RectF rect = new RectF(left, top, right, bottom);

                    // 타입별 둥글고 세련된 칩 배경색 칠하기 (Opacity 0.95 가미)
                    int bgColor;
                    int textColor;
                    if ("event".equals(type)) {
                        bgColor = 0xFF0A252B; // 민트 어두움
                        textColor = 0xFF2DD4BF; // 민트 텍스트
                    } else if ("change".equals(type)) {
                        bgColor = 0xFF2B1B0A; // 오렌지 어두움
                        textColor = 0xFFF59E0B; // 오렌지 텍스트
                    } else if ("original".equals(type)) {
                        bgColor = 0xFF171D26; // 회색 어두움
                        textColor = 0xFF94A3B8; // 회색 텍스트
                    } else {
                        bgColor = 0xFF1E293B; // 기본 남색
                        textColor = 0xFFF8FAFC; // 기본 흰색
                    }

                    // 칩 드로잉
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(bgColor);
                    canvas.drawRoundRect(rect, 14f, 14f, paint);

                    // 칩 테두리 드로잉 (더 또렷한 디자인)
                    paint.setStyle(Paint.Style.STROKE);
                    paint.setColor(0x33FFFFFF); // 연한 흰색 테두리
                    paint.setStrokeWidth(1.5f);
                    canvas.drawRoundRect(rect, 14f, 14f, paint);

                    // 텍스트 기입
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(textColor);
                    paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));

                    float centerX = rect.centerX();
                    float centerY = rect.centerY();

                    if (spanRows > 1) {
                        // 세로 병합 칩 (과목명을 더 크게 쓰고 상하 배치)
                        paint.setTextSize(34f);
                        canvas.drawText(title, centerX, centerY - 10f, paint);
                        
                        if (!note.isEmpty()) {
                            paint.setTextSize(24f);
                            paint.setColor(textColor & 0xAAFFFFFF); // 투명도 살짝 적용
                            canvas.drawText(note, centerX, centerY + 30f, paint);
                        }
                    } else {
                        // 단일 1칸짜리 칩
                        if (!note.isEmpty()) {
                            paint.setTextSize(28f);
                            canvas.drawText(title, centerX, centerY - 6f, paint);
                            paint.setTextSize(20f);
                            paint.setColor(textColor & 0xAAFFFFFF);
                            canvas.drawText(note, centerX, centerY + 24f, paint);
                        } else {
                            paint.setTextSize(30f);
                            canvas.drawText(title, centerX, centerY + 10f, paint);
                        }
                    }

                    // 병합된 모든 셀 방문 기록 마킹
                    for (int r = 0; r < spanRows; r++) {
                        visited[d][p + r] = true;
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return bitmap;
    }
}
