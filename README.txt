TornPulse Targets — Polished Final Review

Replace ONLY patch-v100-hud.cjs in the root of your GitHub repository.
Leave .github/workflows/main.yml unchanged.

Polish changes:
- Dedicated Dashboard / Targets navigation retained.
- Level strip starts at 15 and continues upward only as far as the selected source needs.
- Every level chip shows its target count; empty levels are dimmed.
- Switching live Baldr lists automatically lands on the first available level instead of an empty Level 15.
- Trip Classic preserves Trip's original source ordering instead of alphabetically scrambling it.
- Static Trip rows are labeled AFK? rather than pretending current status is guaranteed.
- New per-target VERIFY button checks only that one static target with Torn API; no bulk AFK refresh.
- If a static target verifies as Hospital/Jail/etc., the attack button disables until it is actually available.
- Brighter electric-blue live names, purple legacy-AFK names, red level accents, status side rails, selected-tab glow, and cleaner compact stat labels.
- Trip Classic contains the curated built-in subset from the prior draft and links to the original 387-target forum source.
- No automated attacks or unattended gameplay.
