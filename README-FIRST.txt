TORNPULSE v0.8.0 VISUAL REDESIGN

FILES TO PUT IN THE REPOSITORY:
1. /patch-v080.cjs
2. /tornpulse-icon.png
3. /tornpulse-splash.png
4. /.github/workflows/main.yml  (replace the current workflow)

WHAT THIS CHANGES:
- App version -> 0.8.0 / Android versionCode 19
- New TornPulse launcher icon
- New noir TornPulse splash screen
- Main app restyled to black/graphite + crimson + silver
- Cleaner rounded cards, controls, bars and spacing
- Floating HUD receives a visual-only polish:
  thinner accent, softer border, tighter padding, cleaner expanded text
- GitHub workflow/artifact naming changed from Comfortable AI to TornPulse

WHAT THIS DOES NOT CHANGE:
- Android package ID (com.comfortableai.torncopilot)
- Torn API mechanics
- API key storage
- Notification logic
- HUD fetch/projection logic
- HUD 60-second polling
- Tap/expand/drag behavior
- Foreground service lifecycle

The patch intentionally fails the CI build if an expected v0.7.3 source fragment
does not match, rather than silently producing a partially patched build.
