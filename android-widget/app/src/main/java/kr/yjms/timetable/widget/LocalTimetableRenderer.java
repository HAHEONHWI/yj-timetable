package kr.yjms.timetable.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import org.json.JSONArray;
import org.json.JSONObject;

public class LocalTimetableRenderer {

    // 칩 가로폭에 맞게 글씨 크기를 자동 조절하여 칸 탈출(Overflow)을 원천 방지하는 헬퍼 메서드
    private static void drawTextFitWidth(Canvas canvas, String text, float centerX, float centerY, Paint paint, float maxWidth) {
        if (text == null || text.isEmpty()) return;
        
        float originalSize = paint.getTextSize();
        float size = originalSize;
        
        // 텍스트 가로 폭이 maxWidth를 초과하는 경우, 1dp씩 점진적으로 크기 축소 (최대 원래 크기의 40% 수준까지 허용)
        while (paint.measureText(text) > maxWidth && size > originalSize * 0.4f) {
            size -= 1.0f;
            paint.setTextSize(size);
        }
        
        // 텍스트 중앙 세로 기준선 보정 적용
        Paint.FontMetrics fm = paint.getFontMetrics();
        float offset = (fm.descent + fm.ascent) / 2f;
        canvas.drawText(text, centerX, centerY - offset, paint);
        
        // 원본 크기로 원복하여 페인트 전역 상태 유지
        paint.setTextSize(originalSize);
    }

    public static Bitmap drawTimetable(Context context, String jsonString, int width, int height) {
        if (width < 300) width = 300;
        if (height < 300) height = 300;

        // 위젯 테마 설정 로드
        SharedPreferences prefs = context.getSharedPreferences("kr.yjms.timetable.widget.PREFS", Context.MODE_PRIVATE);
        String theme = prefs.getString("widget_theme", "dark");
        boolean isLight = "light".equals(theme);

        // 1. 위젯 실제 해상도에 맞춘 동적 비트맵 생성
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // 2. 브러시 및 페인트 설정
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.FILL);

        // 3. 테마별 배경색 채우기
        int bgMainColor = isLight ? 0xFFF8FAFC : 0xFF0F172A;
        paint.setColor(bgMainColor);
        canvas.drawRect(0, 0, width, height, paint);

        // 동적 척도 계산
        float scaleX = width / 800f;
        float scaleY = height / 800f;
        float fontScale = Math.min(scaleX, scaleY);

        try {
            JSONObject root = new JSONObject(jsonString);
            JSONArray gridArr = root.getJSONArray("grid");

            // 격자 오프셋 산정
            float leftMargin = 85f * scaleX;
            float topMargin = 75f * scaleY;
            float gridWidth = width - leftMargin;
            float gridHeight = height - topMargin;
            float colWidth = gridWidth / 5f;
            float rowHeight = gridHeight / 9f;

            // 4. 테마별 격자선 도색
            int gridLineColor = isLight ? 0xFFCBD5E1 : 0xFF1E293B;
            paint.setColor(gridLineColor);
            paint.setStrokeWidth(2f * fontScale);
            paint.setStyle(Paint.Style.STROKE);
            
            // 세로선 그리기
            for (int i = 0; i <= 5; i++) {
                float x = leftMargin + i * colWidth;
                canvas.drawLine(x, 0, x, height, paint);
            }
            // 가로선 그리기
            for (int i = 0; i <= 9; i++) {
                float y = topMargin + i * rowHeight;
                canvas.drawLine(0, y, width, y, paint);
            }

            // 5. 헤더 텍스트 드로잉 (요일 및 교시 라벨)
            paint.setStyle(Paint.Style.FILL);
            paint.setTextAlign(Paint.Align.CENTER);
            paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));

            // 요일 그리기
            int headerTextColor = isLight ? 0xFF334155 : 0xFFF8FAFC;
            paint.setColor(headerTextColor);
            paint.setTextSize(28f * fontScale);
            String[] dayLabels = {"월", "화", "수", "목", "금"};
            for (int i = 0; i < 5; i++) {
                float x = leftMargin + i * colWidth + (colWidth / 2f);
                float y = topMargin / 2f + (10f * scaleY);
                canvas.drawText(dayLabels[i], x, y, paint);
            }

            // 교시 그리기
            int labelTextColor = isLight ? 0xFF64748B : 0xFF94A3B8;
            paint.setColor(labelTextColor);
            paint.setTextSize(26f * fontScale);
            for (int i = 0; i < 9; i++) {
                float x = leftMargin / 2f;
                float y = topMargin + i * rowHeight + (rowHeight / 2f) + (8f * scaleY);
                canvas.drawText(String.valueOf(i + 1), x, y, paint);
            }

            // 6. 2차원 시간표 셀 병합 렌더링
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
                    String className = match.optString("className", "");
                    if (note.isEmpty() && !className.isEmpty()) {
                        note = className;
                    }
                    String type = match.optString("type", "");

                    // 연속된 세로 교시 병합(rowspan) 감지
                    int spanRows = 1;
                    for (int p2 = p + 1; p2 < 9; p2++) {
                        JSONArray nextMatches = dayRow.optJSONArray(p2);
                        if (nextMatches == null || nextMatches.length() == 0) break;
                        JSONObject nextMatch = nextMatches.getJSONObject(0);
                        
                        if (title.equals(nextMatch.getString("title")) &&
                            type.equals(nextMatch.optString("type", "")) &&
                            note.equals(nextMatch.optString("note", ""))) {
                            spanRows++;
                        } else {
                            break;
                        }
                    }

                    // 칩 RectF 영역 계산
                    float gap = 5f * fontScale;
                    float left = leftMargin + d * colWidth + gap;
                    float top = topMargin + p * rowHeight + gap;
                    float right = leftMargin + (d + 1) * colWidth - gap;
                    float bottom = topMargin + (p + spanRows) * rowHeight - gap;
                    RectF rect = new RectF(left, top, right, bottom);

                    // 테마별 색상 설정
                    int bgColor;
                    int textColor;
                    
                    if (isLight) {
                        if ("event".equals(type)) {
                            bgColor = 0xFFCCFBF1;
                            textColor = 0xFF0F766E;
                        } else if ("change".equals(type)) {
                            bgColor = 0xFFFEF3C7;
                            textColor = 0xFFB45309;
                        } else if ("original".equals(type)) {
                            bgColor = 0x22F1F5F9; // 반투명 연회색 (사라진 수업)
                            textColor = 0x4D475569; // 30% 불투명 연회색
                        } else {
                            bgColor = 0xFFE2E8F0;
                            textColor = 0xFF0F172A;
                        }
                    } else {
                        if ("event".equals(type)) {
                            bgColor = 0xFF0A252B;
                            textColor = 0xFF2DD4BF;
                        } else if ("change".equals(type)) {
                            bgColor = 0xFF2B1B0A;
                            textColor = 0xFFF59E0B;
                        } else if ("original".equals(type)) {
                            bgColor = 0x22171D26; // 반투명 어두운회색 (사라진 수업)
                            textColor = 0x4D94A3B8; // 30% 불투명 연회색
                        } else {
                            bgColor = 0xFF1E293B;
                            textColor = 0xFFF8FAFC;
                        }
                    }

                    // 칩 드로잉
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(bgColor);
                    canvas.drawRoundRect(rect, 10f * fontScale, 10f * fontScale, paint);

                    // 칩 테두리 드로잉
                    paint.setStyle(Paint.Style.STROKE);
                    int strokeColor = isLight ? 0x22000000 : 0x44FFFFFF;
                    if ("original".equals(type)) {
                        strokeColor = isLight ? 0x11000000 : 0x22FFFFFF;
                        // 사라진 수업은 테두리를 점선(Dash)으로 표출
                        paint.setPathEffect(new android.graphics.DashPathEffect(new float[]{6f * fontScale, 4f * fontScale}, 0));
                    }
                    paint.setColor(strokeColor);
                    paint.setStrokeWidth(1.5f * fontScale);
                    canvas.drawRoundRect(rect, 10f * fontScale, 10f * fontScale, paint);
                    paint.setPathEffect(null); // 원복

                    // 텍스트 기입 페인트 설정
                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(textColor);
                    paint.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                    if ("original".equals(type)) {
                        // 사라진 과목 텍스트 위에는 취소선(StrikeThru) 긋기
                        paint.setStrikeThruText(true);
                    }

                    float centerX = rect.centerX();
                    float centerY = rect.centerY();
                    float maxTextWidth = rect.width() - (10f * fontScale); // 칩 테두리와의 여백 여유값 확보

                    if (spanRows > 1) {
                        // 세로 병합 칩
                        paint.setTextSize(42f * fontScale);
                        drawTextFitWidth(canvas, title, centerX, centerY - (14f * scaleY), paint, maxTextWidth);
                        paint.setStrikeThruText(false); // 과목명 렌더링 완료 후 취소선 즉시 해제
                        
                        if (!note.isEmpty()) {
                            paint.setTextSize(26f * fontScale);
                            paint.setColor(textColor & 0xCCFFFFFF);
                            drawTextFitWidth(canvas, note, centerX, centerY + (18f * scaleY), paint, maxTextWidth);
                        }
                    } else {
                        // 단일 1칸짜리 칩
                        if (!note.isEmpty()) {
                            paint.setTextSize(34f * fontScale);
                            drawTextFitWidth(canvas, title, centerX, centerY - (12f * scaleY), paint, maxTextWidth);
                            paint.setStrikeThruText(false); // 과목명 렌더링 완료 후 취소선 즉시 해제

                            paint.setTextSize(22f * fontScale);
                            paint.setColor(textColor & 0xCCFFFFFF);
                            drawTextFitWidth(canvas, note, centerX, centerY + (16f * scaleY), paint, maxTextWidth);
                        } else {
                            paint.setTextSize(36f * fontScale);
                            drawTextFitWidth(canvas, title, centerX, centerY, paint, maxTextWidth);
                            paint.setStrikeThruText(false); // 과목명 렌더링 완료 후 취소선 즉시 해제
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
