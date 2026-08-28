TornPulse — In-App Attack Browser

WHY
Build #56 reaches Torn's correct page.php attack endpoint, but an external browser has a separate login session from the official Torn Android app.

WHAT CHANGED
- Keeps the current page.php attack URL:
  https://www.torn.com/page.php?sid=attack&user2ID=<XID>
- Sword now prefers a built-in TornPulse Torn browser on Android.
- The built-in browser uses Android WebView persistent Torn cookies.
- First use: log in to Torn inside the TornPulse browser window.
- After login, close it and tap the sword again if Torn does not automatically return to the target.
- Future sword taps reuse that Torn web session.
- BACK and CLOSE controls are provided at the top.
- External Samsung Internet / Chrome launcher remains as a fallback.
- Pulse startup screen and all Target Radar features remain unchanged.

PRIVACY
- TornPulse does not ask for, read, or store your Torn password.
- Login is performed directly on torn.com inside Android WebView.
- The Torn web session is held by Android WebView cookies for this app.
- TornPulse still uses your existing restricted API key only for read-only companion data.

INSTALL
1. Extract this ZIP.
2. Replace ONLY the root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit and tell ChatGPT: Done

FIRST TEST
1. Install the new APK.
2. Open TARGETS and tap a sword.
3. Torn opens inside TornPulse.
4. If asked to log in, log in on the Torn page.
5. Close the in-app window and tap the sword again.
6. It should now land on that player's attack screen without Samsung Internet or Torn URL Manager.
