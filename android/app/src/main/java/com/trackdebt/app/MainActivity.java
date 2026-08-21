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
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // Force the WebView to be focusable and clickable at the native level
            webView.setFocusable(true);
            webView.setFocusableInTouchMode(true);
            
            // Disable Autofill which often causes hangs on Android 17 preview emulators
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
            }
            
            // Re-claim focus after system animations settle (800ms)
            webView.postDelayed(() -> {
                webView.requestFocus();
                webView.requestFocusFromTouch();
                Log.d("TrackDebt", "Native Handshake: WebView Focus Enforced");
            }, 800);
        }
    }
}
