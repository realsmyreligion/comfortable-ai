TornPulse — TCT Forum Clock + Hour Countdown

Replace ONLY the root GitHub file:
  patch-v100-hud.cjs

Do not change your workflow.

WHAT THIS ADDS
- Live TCT clock in the floating HUD: TCT HH:MM:SS
- Live countdown to the next top of the hour: HOUR 00:MM:SS
- Uses Torn API v2 /forum/timestamp as the server-time source
- Re-syncs on the HUD's normal refresh cycle and ticks locally every second
- Clock sync is isolated: if it fails, Health / Energy / Nerve / status keep working
- Last 60 seconds turns amber; last 10 seconds red; exact :00 turns green
- Clock row hides in the logo-only collapsed HUD
- Existing graphite styling, per-stat timers, cooldown chips, attack/mug alerts, drag and collapse behavior are preserved

After replacing the file, commit it to main and let the existing GitHub Actions APK build run.
