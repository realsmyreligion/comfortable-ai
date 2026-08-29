TornPulse — Full Polish Pass

WHAT THIS PASS CLEANS UP

TARGET RADAR
• Keeps the current compact stat-first layout and red ATTACK button.
• Unknown/stale targets remain locked until TornPulse confirms them READY.
• Visible targets automatically refresh live status about every 60 seconds.
• Hospital timers that expire are marked RECHECK and automatically verified again.
• ATTACK performs a final READY verification and now counts inside the same API headroom budget.
• Scanner progress is visible (CHECKING x/y), plus last-updated age and API headroom.
• Status tabs now show counts: ALL / READY / HOSP / JAIL / AWAY / UNKNOWN.
• Column headings are real aligned columns instead of spacing inside one text string.
• Selected sets show their actual live level range dynamically.
• Pending rows are more clearly faded; unavailable rows are faded further.
• Real ATTACK button gets a cleaner TornPulse red treatment.
• Row expansion now shows how recently that player was checked.

HUD / APP POLISH
• Floating HUD automatically hides while TornPulse itself is in the foreground.
• HUD reappears when TornPulse goes into the background / you switch to Torn.
• Starting the HUD while TornPulse is open immediately keeps it hidden inside the app, so it does not cover TornPulse controls.
• Existing HUD logo, Health/Energy/Nerve, Drug/Booster/Medical symbols, event ticker and Torn clock remain intact.

COMPACTNESS
• Target Radar intro copy is shorter to save vertical phone space.
• Existing unified list, stat values, level filters and Torn-app-first routing are preserved.

INSTALL
1. Extract this ZIP.
2. Replace ONLY the root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX / TypeScript diagnostics: 0 errors
• Feature assertions: PASS

NOTE
Build success still needs the normal GitHub Android compile after upload. Runtime behavior should then be tested on the phone, especially HUD auto-hide/reappear and the 60-second target refresh.
