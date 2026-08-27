TornPulse v1.0.0 — Lettered + Collapsible HUD final polish

ONLY ONE REPO FILE NEEDS TO BE REPLACED:
  patch-v100-hud.cjs  (repo root)

Do NOT change .github/workflows/main.yml again. The active workflow is already correct and will run this replacement patch automatically on commit.

What changed:
- Replaces compact HUD symbols with bold HEALTH / ENERGY / NERVE labels.
- HEALTH label blue, ENERGY green, NERVE orange/red.
- Current number stays white with a category-colored glow until capped.
- Max number stays category-colored.
- When capped, current/max become category-colored and the current value gets the stronger glow.
- Adds a minimize control in the header: — minimizes, ＋ restores.
- Minimized HUD becomes a small logo + live status strip instead of disappearing completely.
- While minimized, bars, cooldowns, detail panel and ticker are hidden.
- Minimized HUD remains draggable and long-press lock still works.
- Minimized state is remembered across overlay rebuilds/restarts.
- Existing attack/mug ticker, stealth handling, alerts, size presets and API behavior remain unchanged.

After uploading/replacing patch-v100-hud.cjs and committing, GitHub Actions should start a new Build TornPulse APK run automatically.
