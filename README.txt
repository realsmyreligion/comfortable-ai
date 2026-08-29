TornPulse — Final Set Order + Polish

MAIN SET ORDER
• SET 1 = low-level targets (Baldr List 3; current live range is shown dynamically)
• SET 2 = mid-level targets (Baldr List 2)
• SET 3 = high-level targets (Baldr List 1)
• Extras and DOMINO remain after the three main sets.

FINAL POLISH
• TornPulse opens on SET 1 (low levels) instead of the high-level set.
• Left/right set navigation follows LOW → MID → HIGH.
• Each set only shows level chips that actually exist in that set, removing dead low-level chips from high-level sets.
• Set metadata identifies LOW LEVEL / MID LEVEL / HIGH LEVEL.
• Keeps the full Build #66 polish base: 60-second status freshness, READY-only ATTACK gating, final live verification, API headroom protection, scanner progress, aligned columns, HUD foreground auto-hide/reappear, launcher-icon pulse, HUD cooldown symbols, Torn-app-first attack routing, and unified target intel.

INSTALL
1. Extract this ZIP.
2. Replace ONLY root patch-v100-hud.cjs in GitHub.
3. Leave .github/workflows/main.yml unchanged.
4. Commit.
5. Tell ChatGPT: Done

VALIDATION
• node --check: PASS
• Target JSX / TypeScript diagnostics: 0 errors
• Build #66 base reached successful APK build/checksum/artifact upload before this set-order-only refinement.
