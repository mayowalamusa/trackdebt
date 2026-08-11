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
        if (bridge != null && bridge.getWebView() != null) {
            View webView = bridge.getWebView();
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            webView.requestFocus();
            webView.requestFocusFromTouch();

            // Ensure focus is requested on touch
            webView.setOnTouchListener(new View.OnTouchListener() {
                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    if (event.getAction() == MotionEvent.ACTION_DOWN || event.getAction() == MotionEvent.ACTION_UP) {
                        if (!v.hasFocus()) {
                            v.requestFocus();
                        }
                    }
                    return false;
                }
            });
        }
    }
}
