TornPulse — Torn App First Attack Links

WHAT CHANGED
- Sword now tries the official Torn Android app first.
- Official Torn Android package: com.ionicframework.tornv2301860
- Target URL remains the current format:
  https://www.torn.com/page.php?sid=attack&user2ID=<ID>
- If the official Torn app is not installed or cannot accept the URL, TornPulse falls back to its built-in Torn browser.
- External browser remains a final fallback.
- No change to Dashboard, HUD, Target Radar, LIVE BALDR, AFK CLASSIC, Verify, ALL/level filters, or pulse startup screen.

EXPECTED FLOW
TARGETS -> sword -> official Torn app (already logged in)
If official Torn app unavailable -> TornPulse browser
If that is unavailable -> external browser

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit and tell ChatGPT: Done

VALIDATION
- node --check: PASS
