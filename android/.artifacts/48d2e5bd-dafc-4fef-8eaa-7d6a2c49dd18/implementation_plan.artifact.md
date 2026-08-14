# Keyboard Input and UI Unresponsiveness Fix

This plan addresses the issue where text fields don't accept input and the app becomes unclickable when the on-screen keyboard appears. The root cause is a conflict between Android 15's Edge-to-Edge enforcement and Capacitor's inset handling, combined with modern CSS viewport units that behave unpredictably during native resizes.

## Proposed Changes

### Configuration & Meta Tags

#### [MODIFY] [index.html](file:///C:/Users/User/Documents/GitHub/trackdebt/index.html)
Add `viewport-fit=cover` and `interactive-widget=resizes-content` to the viewport meta tag.

#### [MODIFY] [__root.tsx](file:///C:/Users/User/Documents/GitHub/trackdebt/src/routes/__root.tsx)
Sync the viewport meta tag in the TanStack Router configuration to match the HTML.

#### [MODIFY] [capacitor.config.ts](file:///C:/Users/User/Documents/GitHub/trackdebt/capacitor.config.ts)
Change `insetsHandling` from `disable` to `css`. This allows Capacitor to provide safe-area variables without creating inert padding.

---

### UI Components

#### [MODIFY] [ui-kit.tsx](file:///C:/Users/User/Documents/GitHub/trackdebt/src/components/ui-kit.tsx)
Replace `min-h-dvh` with `min-h-screen`. Dynamic Viewport Height (`dvh`) can trigger layout loops during native keyboard resizes in WebView environments.

#### [MODIFY] [onboarding.tsx](file:///C:/Users/User/Documents/GitHub/trackdebt/src/components/onboarding.tsx)
Replace `min-h-dvh` with `min-h-screen` in the onboarding container.

## Verification Plan

### Automated Tests
- Run `gradlew build` to ensure the Android project still compiles.

### Manual Verification
- Deploy to an Android device (ideally Android 15).
- Click on various text fields (Business Name, Amount, Customer Name).
- Verify that characters typed on the keyboard appear in the fields.
- Verify that the UI remains interactive (e.g., "Cancel" or "Save" buttons work) while the keyboard is visible.
- Verify that dismissing the keyboard restores the full-screen layout correctly.
