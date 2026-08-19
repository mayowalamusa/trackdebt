package com.trackdebt.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Ensuring WebView focus after system transitions prevents input lock
                webView.postDelayed(webView::requestFocus, 100);
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.requestFocus();
        }
    }
}
