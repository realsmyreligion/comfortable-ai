TornPulse v1.0.0 — Compact City HUD

Replace ONLY the repository-root file:
  patch-v100-hud.cjs

Do not edit .github/workflows/main.yml.

HUD changes:
- Removes tap-to-expand / pull-down detail panel.
- H / E / N remain bold and compact.
- Each stat gets a small time-to-full prompt (or CAPPED) next to its letter.
- Removes the separate bulky cooldown/detail rows from the floating HUD.
- Attack/mug events appear in their own bordered alert box at the bottom.
- Tapping the TornPulse logo collapses the entire HUD to a small logo-only square.
- Tapping the logo again restores the HUD.
- Drag and long-press lock behavior remain.
- Expanded HUD uses a smoky gray procedural cityscape background with a subtle red border.
- Main screen remains Health / Energy / Nerve in bold title case without symbols.
