TornPulse — ATTACK Button + Real Stats + Set Fix

WHAT CHANGED
• Replaces the small sword icon with a clear red ATTACK button.
• Unavailable Hospital/Jail/Away rows keep ATTACK disabled and visibly dimmed.
• Baldr-backed/live targets show TOTAL plus real STR / DEF / SPD / DEX values.
• Classic-only targets no longer waste a second row showing STR — / DEF — / SPD — / DEX —. If split stats are not available, the stat row is hidden.
• Fixed the apparent SET 1 / SET 2 duplication.

WHY SET 1 / SET 2 LOOKED THE SAME
The live source sets are different, but the same Classic target pool was being merged into every set. Because those Classic targets are low-level, they sorted to the front and hid the selected set's real targets on the first page.

NEW SET BEHAVIOR
• Classic targets are matched to the level range of the selected live set.
• Real live/stat-backed targets are prioritized before Classic-only targets within the same level/status.
• SET 1 is labelled LV25+.
• SET 2 is labelled LV21-24.
• SET 3 is labelled LV15-20.
• Existing Extra/DOMINO sets remain available.

PRESERVED
• Unified Target Radar.
• Level and status filters.
• READY vs Hospital/Jail/Away visual separation.
• Official Torn app first for ATTACK.
• Browser fallbacks.
• TornPulse graphite/red/steel styling.
• Real launcher-icon pulse startup.
• HUD 💊 / 🥤 / ✚ indicators.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX / TypeScript transpile diagnostics: 0 errors
