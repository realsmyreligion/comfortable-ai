TORNPULSE v1.0.0 — FINAL HUD POLISH

This bundle adds the locked final HUD design on top of patch-v100.cjs.

1. Upload patch-v100-hud.cjs to the REPO ROOT, beside patch-v100.cjs.
2. Replace .github/workflows/main.yml with the included main.yml.
3. Commit the changes.

The workflow MUST show these two v1 steps:
- Apply v1.0.0 final release
- Apply v1.0.0 final HUD polish

Final HUD behavior:
- TORNPULSE wordmark left, live status right.
- Larger Health / Energy / Nerve values.
- Current value white + category glow while below cap.
- Maximum value always category-colored.
- At cap, current value becomes category-colored with stronger glow.
- Health blue, Energy green, Nerve orange/red.
- Bottom scrolling event ticker for new attacks/mugs and Hospital/Jail release.
- No mug cash amount is invented because Torn's attack payload does not provide it.
- Stealth attackers remain UNKNOWN / STEALTH.
- Existing HUD size presets, position memory, lock, alerts, diagnostics, and package ID are preserved.
