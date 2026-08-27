TORNPULSE v0.8.2 — HEALTH + STATUS HUD

WHAT'S NEW
- Health/Life added to the floating HUD and dashboard.
- Current Torn status in the HUD header (Okay, Hospital, Jail, Traveling, etc.).
- Hospital/Jail/status countdown uses Torn's status `until` timestamp.
- Tap the HUD to expand and see the latest incoming attack result and attacker name when Torn exposes it.
- Stealthed/hidden attackers stay UNKNOWN / STEALTH.
- Incoming attack history is optional: a Limited read-only Torn API key enables it. Core Health/Status/Energy/Nerve still works without attack access.
- Existing Energy/Nerve/cooldown polling, drag/tap behavior, alerts, branding, and package ID are preserved.

INSTALL INTO THE REPO
1. Upload patch-v082.cjs to the repository ROOT beside patch-v081.cjs.
2. Replace .github/workflows/main.yml with the included main.yml.
3. Commit both changes.
4. GitHub Actions will build artifact: tornpulse-v0.8.2-apk.

SECURITY
TornPulse remains read-only. Do not use or store your Torn password in the app.
