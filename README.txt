TornPulse — Mainstream App Overhaul — Phase 1

WHAT CHANGED
• Rebuilds the connected app shell into a compact mainstream mobile layout.
• Fixed bottom navigation: HOME / TARGETS / STATUS / HUD / MORE.
• New compact Dashboard with Health, Energy, Nerve, cooldown strip, Torn clock/status/HUD strip, Target Radar launcher, Quick Actions and Next Move.
• TARGETS keeps the proven unified low→mid→high radar, live READY gating, battle stats and Torn-app-first ATTACK routing, but now sits inside the same app shell.
• New STATUS page keeps bars, Torn status, Torn time, next-hour countdown, sync age and cooldowns together.
• New HUD page gives the floating overlay its own clean control screen.
• New MORE page moves alert-buffer and API/disconnect controls off the Dashboard.
• Existing splash icon pulse, HUD auto-hide inside TornPulse, 60s target freshness, API headroom protection and all existing target logic remain intact.

WHY
The old main screen grew into a long scrolling utility page. This pass reorganizes TornPulse around a familiar phone-app information hierarchy while preserving the working backend/native systems.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Mainstream component/return JSX TypeScript diagnostics: 0 errors
• Synthetic final APP_JS injection: PASS
• Synthetic full APP_JS TypeScript parse diagnostics: 0 errors

NOTE
This is Phase 1 of the visual overhaul. The first phone test should focus on spacing, fit, navigation feel and whether Dashboard shows the right amount of information without excessive scrolling. Android compile still needs the normal GitHub Actions build after upload.
