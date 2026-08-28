TornPulse — Targets Page + Level Picker

What changed:
- Target Assistant moved off the main dashboard onto its own TARGETS page.
- New DASHBOARD / TARGETS navigation at the top of the app.
- Swipeable horizontal LEVEL selector with ALL + every level in the active list.
- Targets are grouped with clear LEVEL dividers.
- Selecting a level resets to ALL-status view so the players are immediately visible.
- Refresh checks live Torn status for the visible filtered page.
- Existing READY / LOW BS / ALL filters remain.

Install into GitHub:
1. Extract this ZIP on your phone.
2. Open the extracted folder.
3. Replace the root GitHub file patch-v100-hud.cjs with this patch-v100-hud.cjs.
4. Commit to main.
5. Do not change main.yml.

Validated:
- node --check: PASS
- Target-page synthetic patch execution: PASS
- JSX/TS parser syntax errors: 0


LEVEL 15+ UPDATE
- Target picker starts at Level 15.
- The first chip is 15+, showing all Level 15 and higher targets.
- Levels below 15 are hidden from the Targets page.
