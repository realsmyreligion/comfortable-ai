TORNPULSE v1.0.0 — FINAL RELEASE BUILD
======================================

FILES IN THIS ZIP
- patch-v100.cjs
- main.yml
- FINAL-QA.txt

UPLOAD / EDIT
1) Upload patch-v100.cjs to the repository ROOT.
   It belongs beside patch-v081.cjs, patch-v082.cjs and patch-v090.cjs.

2) IMPORTANT: main.yml must become:
   .github/workflows/main.yml

   GitHub's phone uploader tends to put it in the repo root instead.
   The safest method is:
   - Open .github/workflows/main.yml
   - Tap Edit
   - Select all
   - Paste the contents of the included main.yml
   - Commit changes

THE NEW ACTIONS RUN MUST SHOW
- Apply v0.8.1 refinement
- Apply v0.8.2 Health + Status HUD
- Apply v0.9.0 release candidate
- Apply v1.0.0 final release
- Verify v1.0.0 patch
- Verify native v1.0 HUD
- Build APK
- Upload TornPulse APK

EXPECTED ARTIFACT
  tornpulse-v1.0.0-apk

V1.0 FINALIZATION
- Version 1.0.0 / Android versionCode 23
- Health remains Torn blue (#3498DB)
- Compact / Standard / Large HUD presets
- Standard preserves the current RC HUD sizing
- Compact hides the cooldown strip to stay extra slim
- HUD preset changes apply live when the HUD is running
- HUD position + lock state remain persistent
- Reset HUD Position control
- System Check panel for API/data/overlay/notifications/HUD state
- Serialized notification scheduling to prevent overlapping reschedule passes
- Attack/status/cooldown alerts retained
- Stale/offline recovery retained
- Same Android package ID retained so upgrades install over prior TornPulse builds
- Existing SecureStore keys retained intentionally so your API connection/settings survive the upgrade

SIGNING NOTE
The v0.8.2 and v0.9.0 APKs were checked and use the same APK signing certificate.
The v1.0 workflow keeps the exact same Android build path. After the v1 APK is built,
we can verify its signer before calling the release completely locked.
