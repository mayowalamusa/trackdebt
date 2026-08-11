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
        if (this.bridge != null) {
            WebView webView = this.bridge.getWebView();
            if (webView != null) {
                // Configure WebView for better focus handling
                webView.setFocusable(true);
                webView.setFocusableInTouchMode(true);
                
                // Request focus with a slight delay to ensure the window is ready
                webView.postDelayed(() -> {
                    webView.requestFocus(View.FOCUS_DOWN);
                    webView.requestFocusFromTouch();
                }, 200);

                // Add a touch listener that ensures focus but doesn't block events
                webView.setOnTouchListener((v, event) -> {
                    if (!v.hasFocus()) {
                        v.requestFocus();
                        v.requestFocusFromTouch();
                    }
                    return false;
                });
            }
        }
    }
}
