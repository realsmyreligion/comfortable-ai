# TornPulse 2.1 — Foreign Stock Radar

This package is the first functional pivot of TornPulse from a general companion app into a foreign-market intelligence app.

## What changed

- New **Foreign Stock Radar** bottom-navigation tab replaces the old generic Market tab.
- Pulls the public YATA foreign-stock export used by current Torn travel tools.
- Normalizes every supported foreign destination and item into one data model.
- Auto-refreshes the foreign feed every **15 seconds while Radar is open**.
- The UI clock refreshes every second, so observation freshness is displayed by the second.
- Freshness states: **LIVE** (<=60s), **RECENT** (<=5m), **STALE** (>5m).
- Search across item, country, and city.
- Toggle sold-out rows on/off.
- Countries are ranked by number of item lines currently in stock, then name.
- Each country card shows in-stock item count, total reported units, source age, abroad price, and up to 12 matching items.
- Highlights the destination the connected Torn account is currently flying toward.
- Shows the next Torn quarter-hour boundary (:00/:15/:30/:45) as restock timing context without claiming a guaranteed restock.
- Existing HUD, account snapshot, cooldown alerts, activity, settings, and travel tracking remain intact.

## Files

- `App.js` — TornPulse 2.1 UI with Foreign Stock Radar.
- `foreignMarket.js` — YATA client, parser, country metadata, freshness and grouping helpers.
- `app.config.js` — 2.1.0 / Android versionCode 28 and copies the foreign-market module into the Expo source tree.
- `main-radar.yml` — RC13 GitHub Actions workflow; restores `foreignMarket.js` into `/src` and publishes the new APK artifact name.

## Repo placement

Place `foreignMarket.js` at the project root beside `App.js`, `tornApi.js`, `core.js`, etc. The RC13 workflow and `app.config.js` both ensure it is available as `src/foreignMarket.js`, matching the import in `App.js`.

## Data honesty

YATA foreign inventory is crowdsourced. TornPulse must show observation age and must never label an old observation as direct real-time Torn inventory. The app polls YATA frequently, but the underlying observation only changes when a contributing player/service reports new shop data.

## Next build

The next layer should persist stock snapshots locally/server-side so TornPulse can calculate depletion velocity, sell-out times, historical restock behavior, and arrival-stock confidence rather than merely displaying the latest observation.
