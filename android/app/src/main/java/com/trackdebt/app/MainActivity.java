package com.trackdebt.app;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Android 15/17 Stability: Stop the window from automatically fitting system bars.
        // This is required for the Keyboard to interact correctly with Edge-to-Edge apps.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // Disable Autofill which often causes hangs on Android 17 preview emulators
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
            }
            
            // Force focus recovery logic
            webView.postDelayed(() -> {
                webView.requestFocus();
                Log.d("TrackDebt", "WebView Native Focus Enforced");
            }, 500);
        }
    }
}
