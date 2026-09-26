# Torn Pulse — Foreign Market V1

This is a clean rebuild of Torn Pulse as a foreign-market-only companion. The old HUD, battle bars, cooldowns, activity pages, generic item market, and general Torn companion features are intentionally removed.

## App structure

- **Radar** — crowdsourced foreign quantities, freshness, country/item search, profit per slot when Torn prices are connected, session depletion tracking, arrival-risk label, and a best-current-run card.
- **Trips** — ranks each country by its strongest current stocked item. With a Torn API key it ranks by projected profit per round-trip minute.
- **Watchlist** — star specific foreign items and keep them together.
- **Settings** — local Torn API key, normal carrying capacity, Tourism multiplier, travel method, Mailing Yourself Abroad, refresh interval, sold-out filtering.

## Data sources

- Foreign quantities: `https://yata.yt/api/v1/travel/export/` (crowdsourced observations).
- Market values: Torn API v2 `torn/items` when the user supplies an API key.

The UI deliberately labels foreign inventory as observed/crowdsourced data. It does not claim to have a direct per-second Torn shop feed.

## Build

The included GitHub Actions workflow builds an ARM64 Android release APK on each push to `main` or manual workflow run.

1. Replace the old repository contents with this project.
2. Keep `.github/workflows/android.yml`.
3. Commit to `main`.
4. Open **Actions → Build Torn Pulse Market V1**.
5. Download the `torn-pulse-market-v1-arm64-apk` artifact.

The Android package remains `com.comfortableai.torncopilot` so this project continues the existing Torn Pulse application identity. If Android reports a signing conflict with a previously installed development APK, uninstall that older APK first and install the new build.

## Version

- App version: **3.0.0**
- Android versionCode: **30**
- Product milestone: **Market V1**
