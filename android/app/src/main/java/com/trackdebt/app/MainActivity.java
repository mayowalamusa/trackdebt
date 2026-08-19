package com.trackdebt.app;

import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("TrackDebt", "MainActivity onCreate - API: " + android.os.Build.VERSION.SDK_INT);
        
        // Android 15 (API 35+) enforces Edge-to-Edge.
        // We ensure the WebView is correctly configured for the Capacitor bridge.
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Ensure the WebView regains focus to prevent input freezing
                webView.post(() -> {
                    webView.requestFocus();
                    Log.d("TrackDebt", "WebView requested focus (post-event)");
                });
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        Log.d("TrackDebt", "MainActivity onResume");
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.requestFocus();
        }
    }
}
