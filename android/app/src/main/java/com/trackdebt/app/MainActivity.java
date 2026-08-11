package com.trackdebt.app;

import android.os.Bundle;
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
            bridge.getWebView().setFocusable(true);
            bridge.getWebView().setFocusableInTouchMode(true);
            bridge.getWebView().requestFocus();
        }
    }
}
