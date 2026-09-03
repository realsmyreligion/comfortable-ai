# TornPulse Google Play Release Guide

This project is prepared for the permanent Google Play application ID:

`com.tornpulse.app`

Do not change this ID after creating the Play Console application.

## Phase 1 — Create the owner account

1. Open the [Google Play Console](https://play.google.com/console/).
2. Register using the Google account that should permanently own TornPulse.
3. Select a personal or organization account truthfully.
4. Complete Google's identity, contact, and payment verification.
5. Keep the developer account and recovery information under the owner's control.

New personal accounts may have testing requirements before production access. Follow the exact testing requirement shown inside the account because Google can change it by account type and creation date.

## Phase 2 — Create TornPulse

Create a new app with these starting values:

- App name: **TornPulse**
- Default language: **English (Canada)**
- App or game: **App**
- Free or paid: **Free**
- Application ID: **com.tornpulse.app**

The application ID is supplied by the uploaded bundle; verify it before continuing.

## Phase 3 — Create and protect the upload key

Google Play App Signing should manage the production app-signing key. TornPulse still needs a private upload key to authenticate future bundles.

The GitHub workflow expects these encrypted repository secrets:

- `TORNPULSE_UPLOAD_KEYSTORE_BASE64`
- `TORNPULSE_UPLOAD_STORE_PASSWORD`
- `TORNPULSE_UPLOAD_KEY_ALIAS`
- `TORNPULSE_UPLOAD_KEY_PASSWORD`

Never commit the `.jks` file or passwords to the repository. Keep a second encrypted backup of the upload key outside GitHub. Losing it creates a recovery process for every future update.

## Phase 4 — Complete required Play Console declarations

Use the prepared files in `play-store/`:

- `LISTING.md` for the title and descriptions.
- `PRIVACY-POLICY.md` and `docs/privacy.html` for the public privacy policy.
- `DATA-SAFETY.md` as the answer worksheet.
- `OVERLAY-DISCLOSURE.md` for the in-app and review explanation.
- `ASSET-CHECKLIST.md` for graphics and screenshots.

Before publishing, replace every bracketed placeholder in the privacy policy, host `docs/privacy.html` at a stable public HTTPS address, and enter that URL in Play Console and inside the app listing.

## Phase 5 — Build the store bundle

After the four signing secrets exist, run **Build TornPulse Google Play Bundle** from GitHub Actions. Its artifact is:

`tornpulse-v1.0.0-play-aab/app-release.aab`

The workflow verifies the signature and SHA-256 checksum. Upload the `.aab`, not an APK, to Play Console.

## Phase 6 — Test before production

1. Upload the bundle to **Internal testing** first.
2. Install TornPulse using the Play testing link.
3. Test API-key connection, secure reconnection, notifications, HUD permission, right-edge lock, vertical movement, minimize/expand, screen rotation, reboot, and Baldr List linking.
4. Test at least one phone running the oldest supported Android version and one current Android version.
5. Complete any closed-test requirement shown by the Play Console.
6. Promote the tested bundle rather than rebuilding different bytes for production.

## Release blockers

The first Play submission cannot happen until all of these are available:

- Verified Play Console developer account
- Private upload key and four GitHub secrets
- Public privacy-policy URL
- Support email
- Phone screenshots and 1024 × 500 feature graphic
- Completed Data safety, App access, Ads, Content rating, Target audience, and Foreground service declarations

