TORNPULSE v0.9.0 RELEASE CANDIDATE
====================================

What this RC adds
- Native incoming-attack notifications while the floating HUD is running (Limited read-only key required).
- Hospital/Jail release notifications.
- User-facing toggles for cooldown, status-release and incoming-attack alerts.
- Incoming attack age in the app and expanded HUD.
- Long-press the HUD to lock/unlock its position; lock state persists.
- Better stale/offline indication and last-sync age.
- Final version/copy cleanup for the v1.0 runway.

Upload / replace
1) Put patch-v090.cjs in the repository ROOT beside patch-v081.cjs and patch-v082.cjs.
2) Replace .github/workflows/main.yml with the included main.yml.
3) Commit both files.
4) GitHub Actions should show: Apply v0.9.0 release candidate.
5) The successful artifact is named: tornpulse-v0.9.0-rc-apk

Important
- Keep patch-v081.cjs and patch-v082.cjs in the repo root. The workflow applies the release chain in order.
- Attack identity remains UNKNOWN / STEALTH when Torn does not expose the attacker.
- Incoming attack push alerts operate while the native TornPulse HUD service is running.

Visual polish:
- Health now uses Torn-style blue (#3498DB) in both the dashboard and floating HUD.
