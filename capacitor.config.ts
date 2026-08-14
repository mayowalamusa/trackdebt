import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.trackdebt.app',
  appName: 'Track Debt',
  webDir: 'dist/capacitor',
  plugins: {
    // @capacitor/android's built-in SystemBars plugin (bundled, not a
    // separately-added dependency) installs its own WindowInsets listener
    // that — on Android 15+ devices specifically (gated by the device's
    // actual OS version via Build.VERSION.SDK_INT, not our
    // targetSdkVersion) — adds bottom padding to the WebView's parent
    // equal to the keyboard's height whenever the IME is visible. That's
    // on top of the window already resizing via
    // android:windowSoftInputMode="adjustResize" in AndroidManifest.xml,
    // so the two mechanisms double-compensate: a chunk of the screen
    // above the keyboard becomes inert padding that isn't part of the
    // WebView, making it unclickable. adjustResize alone is correct and
    // sufficient (and is still required for pre-Android-15 devices, where
    // this padding logic doesn't run at all) — this just stops the
    // built-in plugin from redundantly compensating for the same inset
    // a second time.
    SystemBars: {
      insetsHandling: 'disable',
    },
  },
};

export default config;
