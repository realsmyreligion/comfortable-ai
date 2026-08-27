TORNPULSE — HUD SETTINGS PATCH
=============================

WHAT THIS ADDS
- HUD size: Compact / Standard / Large
- HUD opacity: 45%–100%
- Toggle TCT clock
- Toggle top-of-hour countdown
- Toggle Health / Energy / Nerve timers
- Toggle cooldown strip (💊 / 🥤 / ✚)
- Toggle attack / mug alerts
- Lock / unlock HUD position
- Reset HUD position
- Settings persist after app/HUD restart
- Existing long-hold HUD lock remains synchronized with the Settings screen

INSTALL
1. In your GitHub repository root, replace ONLY:
   patch-v100-hud.cjs
2. Commit the replacement directly to main.
3. Do NOT change .github/workflows/main.yml.
4. The existing Build TornPulse APK GitHub Action will run automatically.

NOTES
- Existing TCT clock, hour countdown, Health/Energy/Nerve HUD, cooldown symbols, status tracking, attack/mug alerts, dragging and compact collapse are retained.
- HUD settings are applied live while the floating HUD is running and are saved for future launches.
