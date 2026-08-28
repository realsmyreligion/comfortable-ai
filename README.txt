TornPulse — Target Radar Final Cleanup

WHAT CHANGED
• Target Radar now uses TornPulse graphite / red / steel styling instead of purple AFK styling.
• Player names are clean near-white; level stays TornPulse red.
• Rows are compact and stat-first: Name, Level, TOTAL, State / STR, DEF, SPD, DEX.
• Baldr-backed targets show real total + split battle stats from the source data.
• Classic AFK-only targets show their available total cap and dashes for unavailable split stats. No fabricated numbers.
• Big AFK / AFK? / Trip Classic clutter is removed from normal rows.
• Underlying sources remain merged and duplicate IDs remain collapsed.
• Target set labels are TornPulse SET 1 / SET 2 / SET 3 etc rather than prominent Baldr branding.
• READY stays bright and attackable; Hospital/Jail/Away remain faded with disabled sword.
• Status bands remain READY, STATUS UNKNOWN, HOSPITAL, JAIL, AWAY / OTHER.
• Official Torn app remains the first attack-link destination.
• HUD 💊 / 🥤 / ✚ symbols remain intact.
• Startup screen now loads Android's actual installed TornPulse launcher icon and pulses that exact icon.

INSTALL
1. Extract this ZIP.
2. Replace ONLY the root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX/TypeScript transpile diagnostics: 0
