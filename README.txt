TornPulse — Live Status Attack Gate

WHAT CHANGED
• Visible target pages automatically check live Torn status.
• STATUS UNKNOWN / CHECKING targets are temporarily faded and ATTACK is disabled.
• Only confirmed READY players receive the bright red active ATTACK button.
• Hospital / Jail / Travel / Fallen / Federal targets fade further and remain disabled.
• ATTACK performs one final live status check immediately before opening Torn.
• If a previously READY player has become unavailable, TornPulse updates the row and does not open the attack page.
• Existing stat layout, set filtering, launcher-icon splash, HUD symbols, and Torn-app-first routing remain intact.

WHY
A target can be listed in the source but currently be in Hospital. Build #63 allowed unknown (?) rows to be attacked before a live status refresh. This patch removes that gap.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX / TypeScript transpile diagnostics: 0 errors
