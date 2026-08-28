TornPulse — page.php Attack Fix + Pulse Boot

WHAT THIS FIXES
- Torn retired loader.php for the attack screen.
- Uses the current attack format:
  https://www.torn.com/page.php?sid=attack&user2ID=<XID>
- Keeps the Build #55 native external-browser launcher, which successfully bypassed the Torn Android app URL Manager.
- Keeps profile fallback if the attack page cannot be opened.

STARTUP POLISH
- Replaces the old small startup mark/spinner with a large centered TornPulse TP mark.
- Gentle heartbeat scale pulse.
- Expanding red glow pulse.
- Thin animated red pulse line.
- Minimal black startup screen with TORNPULSE / SYNCING CITY INTEL.

TARGET RADAR RETAINED
- ALL | 15 | 16 | 17 ...
- LIVE BALDR + AFK CLASSIC
- status scanning / Verify
- flashy names and level grouping

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit and tell ChatGPT: Done

VALIDATION
- node --check: PASS
- Target components TSX parse: 0 errors
- Synthetic post-patch APP_JS TSX parse: 0 errors
- Synthetic attack endpoint: page.php present, loader.php attack endpoint absent
