TornPulse — Full Perfect Polish Pass — Build #65 Marker Fix

WHY BUILD #65 FAILED
The polish features were not the problem. patch-v100-hud.cjs used three exact text markers from an older v1.0 code shape. The first failed before Android generation.

FIXED
• HUD host-visibility constants now anchor to the current ACTION_STOP line.
• HUD foreground-hide handler now inserts before the current startAsForeground() call.
• AppState replacement now matches the current v1.0 refreshSystemState() hook.
• HUD start replacement now matches the current setOverlayReady(true) flow.
• All Full Polish Pass features remain unchanged.

INSTALL
1. Extract this ZIP.
2. Replace ONLY the root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Build #65 failure log reviewed and all three stale markers corrected.
