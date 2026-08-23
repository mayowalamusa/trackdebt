package com.trackdebt.app;

import android.graphics.Rect;
import android.os.Bundle;
import android.view.View;
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
        // Must call before super so the splash screen installs correctly.
        super.onCreate(savedInstanceState);

        // Enable edge-to-edge: content draws under status bar and navigation
        // bar. Without this, Android 15 still enforces its own edge-to-edge
        // behavior but in a way we can't control.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        // Ensure the WebView can receive focus and input normally.
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);

        // Disable autofill on the WebView — it's handled inside the web
        // layer and the native autofill framework causes input hangs on
        // some Android 15+ builds.
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        }

        // KEYBOARD FIX FOR ANDROID 15+
        //
        // On Android 15+, windowSoftInputMode="adjustPan/adjustResize" is
        // a no-op once setDecorFitsSystemWindows(false) has been called.
        // The IME simply opens over the content with no automatic resize or
        // pan — which is exactly the symptom: keyboard appears, fields stop
        // receiving visual input, app appears frozen.
        //
        // The correct replacement is WindowInsetsAnimationCallback:
        // as the keyboard animates in/out, we read the IME inset height and
        // translate the WebView upward by the same amount, so the focused
        // field is always above the keyboard. This is what Chrome does
        // internally, which is why Chrome on the same device works fine.
        //
        // We use translationY rather than changing layout params because:
        //   1. It animates in sync with the keyboard animation.
        //   2. It doesn't trigger a layout pass, so there's no flicker.
        //   3. It works on all API levels from 21+.

        ViewCompat.setWindowInsetsAnimationCallback(
            webView,
            new WindowInsetsAnimationCompat.Callback(
                WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP
            ) {
                private int startBottom = 0;
                private int endBottom = 0;

                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    // Capture where we are before the animation starts.
                    startBottom = ViewCompat
                        .getRootWindowInsets(webView)
                        .getInsets(WindowInsetsCompat.Type.ime())
                        .bottom;
                }

                @NonNull
                @Override
                public WindowInsetsAnimationCompat.BoundsCompat onStart(
                    @NonNull WindowInsetsAnimationCompat animation,
                    @NonNull WindowInsetsAnimationCompat.BoundsCompat bounds
                ) {
                    // Capture where we'll end up after the animation.
                    endBottom = ViewCompat
                        .getRootWindowInsets(webView)
                        .getInsets(WindowInsetsCompat.Type.ime())
                        .bottom;
                    return bounds;
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> runningAnimations
                ) {
                    // Called every frame during keyboard open/close.
                    // Translate the WebView upward by the current IME height
                    // so the content stays above the keyboard.
                    int imeBottom = insets
                        .getInsets(WindowInsetsCompat.Type.ime())
                        .bottom;
                    int navBottom = insets
                        .getInsets(WindowInsetsCompat.Type.navigationBars())
                        .bottom;
                    // The translation we need is the IME height minus the
                    // navigation bar height (already accounted for in layout).
                    int translation = Math.max(0, imeBottom - navBottom);
                    webView.setTranslationY(-translation);
                    return insets;
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    // Snap to the final position in case onProgress frames
                    // didn't cover the full distance (e.g. instant show).
                    WindowInsetsCompat rootInsets =
                        ViewCompat.getRootWindowInsets(webView);
                    if (rootInsets != null) {
                        int imeBottom = rootInsets
                            .getInsets(WindowInsetsCompat.Type.ime())
                            .bottom;
                        int navBottom = rootInsets
                            .getInsets(WindowInsetsCompat.Type.navigationBars())
                            .bottom;
                        int translation = Math.max(0, imeBottom - navBottom);
                        webView.setTranslationY(-translation);
                    }
                }
            }
        );

        // Also set a plain WindowInsets listener so the initial padding
        // for status bar and navigation bar is applied without IME
        // interfering — this keeps content from sliding under the nav bar
        // when no keyboard is visible.
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            // When the IME is NOT animating (i.e. keyboard is fully hidden),
            // snap translationY to zero so content sits at its natural position.
            boolean imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
            if (!imeVisible) {
                v.setTranslationY(0);
            }
            // Return unmodified insets so children can read them.
            return insets;
        });
    }
}
