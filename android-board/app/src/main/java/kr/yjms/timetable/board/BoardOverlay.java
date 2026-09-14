package kr.yjms.timetable.board;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.TextView;

final class BoardOverlay {

    private static final String TAG = "BoardOverlay";

    private BoardOverlay() {
    }

    static boolean show(Context context, String title, String body, long durationMs) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            return false;
        }

        final WindowManager manager =
            (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        if (manager == null) return false;

        final TextView message = new TextView(context);
        message.setText(title + (body.length() == 0 ? "" : "\n" + body));
        message.setTextSize(24);
        message.setTextColor(Color.WHITE);
        message.setGravity(Gravity.CENTER);
        message.setPadding(48, 30, 48, 30);

        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.rgb(27, 42, 74));
        background.setCornerRadius(24);
        message.setBackground(background);

        int windowType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        final WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.y = 24;

        try {
            manager.addView(message, params);
        } catch (Exception error) {
            Log.w(TAG, "show failed: " + error.getMessage());
            return false;
        }

        final boolean[] dismissed = {false};
        final Runnable dismiss = new Runnable() {
            @Override
            public void run() {
                if (dismissed[0]) return;
                dismissed[0] = true;
                try {
                    manager.removeView(message);
                } catch (Exception error) {
                    Log.w(TAG, "dismiss failed: " + error.getMessage());
                }
            }
        };
        message.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                dismiss.run();
            }
        });
        new Handler(Looper.getMainLooper()).postDelayed(dismiss, durationMs);
        return true;
    }
}
