# TornPulse V17 — In-App Chat + Google Play Preparation

## Added

- In-app Chat Hub with Faction Chat and Global Chat choices
- Torn's official authenticated chat interface stays inside TornPulse
- Embedded-session privacy disclosure
- Permanent Google Play application ID: `com.tornpulse.app`
- Production Android App Bundle (`.aab`) build target
- Upload-key signing enforcement and signature verification
- Google Play listing, privacy, Data safety, overlay declaration, and asset checklists

## Preserved

- Approved 100dp thin right-edge HUD rail
- Locked right-edge position with vertical movement
- TP minimize/expand control
- Health, Energy, Nerve, Happiness, Drug, Booster, Medical, Torn time, and Baldr List displays
- Restricted Torn API key stored locally

## Important

The Chat Hub displays Torn's official web chat inside an embedded TornPulse browser. TornPulse does not use an undocumented chat API and does not copy or store chat messages. The first use may require the user to sign into Torn inside that embedded session.

The signed Google Play bundle cannot be produced until the repository contains the four encrypted upload-key secrets described in `GOOGLE-PLAY-RELEASE-GUIDE.md`.
