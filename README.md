# Comfortable AI v0.5

A mobile-first, read-only Torn co-pilot for Mr. Comfortable.

## What this build does
- Live Torn API v2 Bars + Cooldowns
- Energy and Nerve cap countdowns
- Drug / Booster / Medical cooldown countdowns
- Android local notifications scheduled from Torn's real `full_time`
- Secure API key storage using Expo SecureStore
- Demo Mode that works without a Torn API key
- Basic Next Move recommendations
- Automatic refresh every 2 minutes while open and on return to foreground
- GitHub Actions workflow that builds an installable debug APK

## Security
Never commit your Torn API key. The app stores it locally in Android secure storage. Comfortable AI never needs your Torn password.

## Torn key access
Bars and Cooldowns both require only a **Minimal access** Torn API key according to Torn API v2.

## Build locally
Requires Node 22.13+.

```bash
npm install
npx expo install --fix
npm run selftest
npm run apk:debug
```

APK output:
`android/app/build/outputs/apk/debug/app-debug.apk`

## Build automatically on GitHub
Push this folder's contents to the root of the `comfortable-ai` repository. The included **Build Android APK** workflow runs on every push to `main` or manually from the Actions tab. Download the `comfortable-ai-debug-apk` artifact when the job finishes.

## Important v0.5 scope
This version deliberately favors reliability over feature count. Background polling while Android fully suspends the app is not yet promised; notifications are scheduled from the latest real Torn snapshot and are re-scheduled whenever the app syncs.
