package com.trackdebt.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Ensure WebView is focusable and gains focus to accept input
        // Using the bridge's WebView is more reliable than findViewById
        if (this.bridge != null) {
            View webView = this.bridge.getWebView();
            if (webView != null) {
                webView.setFocusable(true);
                webView.setFocusableInTouchMode(true);
                
                // Request focus in a post to ensure it happens after layout
                webView.post(() -> {
                    webView.requestFocus(View.FOCUS_DOWN);
                    webView.requestFocusFromTouch();
                });

                // Remove the manual onTouchListener which was forcing the keyboard
                // and potentially interfering with WebView's internal focus management.
                webView.setOnTouchListener(null);
            }
        }
    }
}
