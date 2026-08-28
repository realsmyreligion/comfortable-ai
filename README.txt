TornPulse Targets — ALL + Attack Link Fix

Changes:
- Adds ALL as the first level filter and makes it the default.
- ALL view keeps targets grouped under LEVEL 15, LEVEL 16, LEVEL 17, etc.
- Individual level chips still filter to that exact level.
- Renames the live status tab to ALL STATES so it is not confused with the level ALL filter.
- Sword is always actionable and opens Torn's direct attack URL for the selected XID.
- If Android/Torn cannot open the attack URL, TornPulse falls back to that player's Torn profile instead of a dead end.
- Status colors and Verify are advisory; Torn itself decides whether the attack can proceed.

Install workflow:
1. Extract this ZIP.
2. Replace only root patch-v100-hud.cjs in GitHub.
3. Do not change .github/workflows/main.yml.
4. Commit and tell ChatGPT Done.
