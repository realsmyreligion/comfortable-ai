TornPulse — In-App Attack Browser • Build #57 Kotlin Fix

WHY BUILD #57 FAILED
The Target/WebView patch applied correctly, but the final Android compile found one React Native Kotlin compatibility issue:
  currentActivity
must be referenced through the module's ReactApplicationContext in this project:
  appContext.currentActivity

THIS FIX
- Changes only that native activity reference.
- Keeps TornPulse's built-in Torn WebView attack browser.
- Keeps persistent Torn WebView cookies/session.
- Keeps current page.php attack URLs.
- Keeps BACK / CLOSE controls.
- Keeps external browser fallback.
- Keeps ALL / level filters, LIVE BALDR, AFK CLASSIC, Verify, and Target Radar styling.
- Keeps the animated TornPulse pulse boot screen.
- Does not change .github/workflows/main.yml.

FIRST USE AFTER A SUCCESSFUL BUILD
1. Install the APK.
2. TARGETS -> tap a sword.
3. Torn opens inside TornPulse.
4. If Torn asks you to log in, log in directly on torn.com in that window.
5. The Android WebView cookie should persist for later sword taps.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit and tell ChatGPT: Done

VALIDATION
- node --check: PASS
- Build #57 failure source identified from GitHub Actions log: unresolved currentActivity in ComfortableOverlayModule.kt.
- Corrected reference: appContext.currentActivity.
