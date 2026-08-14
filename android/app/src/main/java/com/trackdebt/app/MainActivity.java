package com.trackdebt.app;

import android.os.Bundle;
import android.view.View;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Fix for Android 15 Edge-to-Edge keyboard resizing issues.
        // We apply insets as padding to the native view and zero them out for the WebView.
        View rootView = getBridge().getWebView().getRootView();
        ViewCompat.setOnApplyWindowInsetsListener(rootView, (view, windowInsets) -> {
            int types = WindowInsetsCompat.Type.ime() | WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets insets = windowInsets.getInsets(types);

            // Apply system bar and keyboard insets as padding to the container view
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom);

            // Return a new insets object with insets set to ZERO for the WebView.
            // This prevents the WebView's internal (and buggy) resizing logic from triggering.
            return new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(types, Insets.NONE)
                    .build();
        });
    }
}
