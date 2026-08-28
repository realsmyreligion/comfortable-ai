TornPulse — Unified Target Radar

WHAT CHANGED
• BALDR + AFK Classic now live on ONE target board.
• No separate LIVE BALDR / AFK CLASSIC pages or mode switch.
• Duplicate player IDs are merged into one row.
• Every row carries a compact source tag: BALDR, AFK, or B+AFK.
• Targets are organized by LEVEL first, then current STATE.
• State bands: READY, UNCHECKED, HOSPITAL, JAIL, AWAY / OTHER.
• READY targets stay bright and attackable.
• Hospital / Jail / Travel / Fallen / Federal targets stay faded and the sword is disabled.
• UNCHECKED targets stay neutral until refreshed; TornPulse does not guess their live status.
• Refresh checks the visible mixed page, including AFK targets.
• Baldr set selector remains compact; AFK Classic stays merged in at all times.
• Level filters remain: ALL, 15, 16, 17, etc.
• State filter added: ALL, READY, HOSPITAL, JAIL, AWAY, UNCHECKED.
• HUD Drug / Booster / Medical symbols remain: 💊 🥤 ✚.
• Torn-app-first attack routing remains intact.
• Pulsing TornPulse startup screen remains intact.

EXPECTED FLOW
TARGETS -> choose level -> choose state if wanted -> refresh -> READY rows bright -> tap sword -> official Torn app first.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX/TypeScript parse: 0 errors
