TORN PULSE 2.0.0 — SHELL REBUILD

PURPOSE
This package begins the Torn Pulse 2.0 rebuild around the approved clean dark/blue
mobile design. It preserves the compliant Torn API foundation and Android overlay
engine while replacing the old top-level app structure.

WHAT IS NEW IN THIS MILESTONE
- New graphite + Torn Pulse blue/cyan visual system.
- New Home dashboard hierarchy:
  Player Status -> Vitals -> Cooldowns -> Smart Pulse -> Quick Actions -> HUD.
- New five-tab primary navigation:
  Home / Travel / Market / Activity / More.
- New live HH:MM:SS TCT clock in the primary header.
- New Activity page for status, incoming attack, travel and cooldown-ready signals.
- New More page for HUD settings, Baldr's List and account/notification controls.
- Travel and Item Market are now integrated into the new navigation shell.
- Market purchases still open Torn for player confirmation; Torn Pulse does not buy.
- Baldr's List remains an independent external link; no internal target scanner.
- Version is unified at 2.0.0 / Android versionCode 27.

ARCHITECTURE CLEANUP
The UI is now normal editable App.js source. GitHub no longer replays the old
v0.8-v1.1 patch chain to construct the app on every build. app.config.js reads
App.js, core.js and tornApi.js directly and retains the native Android overlay
plugin. Future UI work should be made directly in source.

COMPLIANCE RULE
Torn Pulse informs, calculates, reminds and links. Gameplay actions remain under
the player's control in Torn. It does not auto-attack, auto-buy, auto-travel,
commit crimes, use items, or scrape/background-monitor Torn pages.

CURRENT HUD STATUS
The working Android right-edge overlay engine from the compliant foundation is
preserved. The app-side HUD control has been redesigned for 2.0. The native
collapsed/expanded overlay's full visual reskin is the next migration milestone;
this package intentionally does not risk breaking the working overlay engine while
the new application shell is established.

BUILD
1. Upload the contents of this ZIP to the existing GitHub repository, preserving
   folder paths including .github/workflows/main.yml, src/ and scripts/.
2. Commit to main (or run the workflow manually).
3. GitHub Actions runs core tests, the 2.0 foundation verifier, an Expo bundle
   validation, Android prebuild, native HUD checks, and the release APK build.
4. Download the workflow artifact named:
   tornpulse-v2.0.0-shell-apk

LOCAL CHECKS
npm run selftest
npm run verify

NEXT MILESTONES
- Rebuild the native floating HUD visual layer to match the approved blue/cyan
  collapsed rail + expanded panel concept.
- Expand Travel from flight tracking into the full destination/detail experience
  using only accurate/API-supported information.
- Expand Market into Search -> Item Details -> Listings while keeping purchase
  actions in Torn.
- Split Settings into HUD / Notifications / Appearance / API & Account.
