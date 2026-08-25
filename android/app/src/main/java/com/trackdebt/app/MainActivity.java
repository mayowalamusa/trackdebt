package com.trackdebt.app;

import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.annotation.NonNull;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.util.List;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge: let content draw behind status bar and nav bar.
        // Mandatory on Android 15+ (targetSdk 35 enforces this regardless).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        }

        // KEYBOARD FIX FOR ANDROID 15+ (edge-to-edge mode)
        //
        // Problem: setDecorFitsSystemWindows(false) makes adjustResize and
        // adjustPan silent no-ops on Android 15+. The keyboard opens over
        // the content — nothing moves, inputs are hidden, and because the
        // WebView touch coordinate map is misaligned, the app appears frozen.
        //
        // Previous attempt used setTranslationY on the WebView, which caused
        // a white gap: the WebView slid up but its layout bounds stayed fixed,
        // so the area between the WebView bottom and the keyboard top showed
        // the window background. Also conflicted with Capacitor's own insets
        // listener, causing the freeze-after-open symptom.
        //
        // Correct fix: apply bottom padding to the WebView's parent
        // (Capacitor's CoordinatorLayout) equal to the IME height each frame.
        // This genuinely resizes the usable area, exactly like adjustResize
        // used to do. The WebView fills its parent, so it shrinks accordingly.
        // The WebView's own "scroll focused element into view" logic then
        // works normally within that resized area — no gap, no freeze.

        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null) return;

        final int originalPaddingBottom = parent.getPaddingBottom();

        ViewCompat.setWindowInsetsAnimationCallback(
            parent,
            new WindowInsetsAnimationCompat.Callback(
                WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP
            ) {
                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> runningAnimations
                ) {
                    int imeInset = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
                    int navInset = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
                    int keyboardHeight = Math.max(0, imeInset - navInset);
                    parent.setPadding(
                        parent.getPaddingLeft(),
                        parent.getPaddingTop(),
                        parent.getPaddingRight(),
                        originalPaddingBottom + keyboardHeight
                    );
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    // Snap to final state for devices where onProgress is not
                    // called (instant keyboard show with no animation frame).
                    WindowInsetsCompat rootInsets = ViewCompat.getRootWindowInsets(parent);
                    if (rootInsets != null) {
                        int imeInset = rootInsets.getInsets(WindowInsetsCompat.Type.ime()).bottom;
                        int navInset = rootInsets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
                        int keyboardHeight = Math.max(0, imeInset - navInset);
                        parent.setPadding(
                            parent.getPaddingLeft(),
                            parent.getPaddingTop(),
                            parent.getPaddingRight(),
                            originalPaddingBottom + keyboardHeight
                        );
                    }
                }
            }
        );
    }
}
