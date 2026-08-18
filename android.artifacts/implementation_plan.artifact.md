# Fix InputConnectionWrapper Timeout Error

The error `InputConnectionWrapper.waitForInputConnectionFutureInternal(): Failed to get the input connection call's result` is a known issue in Capacitor/WebView applications on Android 14+ (especially with Gboard). It occurs when the UI thread is busy and the Input Method Editor (IME) times out waiting for a response from the WebView's internal InputConnection.

## Proposed Changes

### Android App

#### [MODIFY] [MainActivity.java](file:///C:/Users/User/Documents/GitHub/trackdebt/android/app/src/main/java/com/trackdebt/app/MainActivity.java)
- Override `onPause()` to explicitly call `clearFocus()` on the WebView. This ensures the `InputConnection` is properly released when the activity moves to the background, preventing stale connection timeouts.

### Configuration

#### [MODIFY] [capacitor.config.ts](file:///C:/Users/User/Documents/GitHub/trackdebt/capacitor.config.ts)
- Add `android: { captureInput: true }` to the configuration. This tells Capacitor to use a simpler `BaseInputConnection` which is less prone to timeouts than the default WebView implementation.

#### [MODIFY] [capacitor.config.json](file:///C:/Users/User/Documents/GitHub/trackdebt/capacitor.config.json)
- Add `"android": { "captureInput": true }` to match the TypeScript configuration.

#### [MODIFY] [capacitor.config.json](file:///C:/Users/User/Documents/GitHub/trackdebt/android/app/src/main/assets/capacitor.config.json)
- Update the cached assets configuration to ensure the change is applied immediately without requiring a full sync.

## Verification Plan

### Manual Verification
- Deploy the app to an Android device/emulator.
- Interact with text inputs and open/close the keyboard multiple times.
- Check Logcat for the disappearance of the `InputConnectionWrapper` timeout errors.
- Verify that the keyboard still functions correctly for basic input.
