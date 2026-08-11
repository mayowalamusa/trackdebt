package com.trackdebt.app;

import android.os.Bundle;
import android.view.MotionEvent;
import android.view.View;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Ensure WebView is focusable and gains focus to accept input
        View webView = findViewById(R.id.webview);
        if (webView != null) {
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
            webView.requestFocusFromTouch();

            // Ensure focus is requested on touch
            webView.setOnTouchListener((v, event) -> {
                if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_UP) {
                    if (!v.hasFocus()) {
                        v.requestFocus();
                    }
                }
                return false;
            });
        }
    }
}
