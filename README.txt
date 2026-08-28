TornPulse Targets — External Browser Attack Fix

WHY:
Android's official Torn app intercepts torn.com links from TornPulse and opens its URL Manager instead of navigating to the attack page.

FIX:
- Keeps ALL | 15 | 16 | 17... and every Build #54 Target Radar feature.
- Adds a native Android browser launcher to the existing ComfortableOverlay module.
- Sword explicitly opens the Torn attack URL in a real browser package, bypassing the official Torn app's URL Manager.
- Tries Samsung Internet, Chrome, Firefox, Brave, Edge, Opera, Vivaldi and DuckDuckGo.
- If the attack URL fails, the same external-browser route tries the player's profile.
- No automated attacks. The sword only opens the user-selected Torn page.

IMPORTANT:
The first time, you may need to log into Torn in the browser. Browser cookies are separate from the official Torn Android app. After login, attack links should open directly there.

INSTALL:
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit and tell ChatGPT Done.
