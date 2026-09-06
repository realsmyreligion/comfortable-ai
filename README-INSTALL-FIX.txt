Torn Pulse install-fix workflow

Changes:
- Builds only ARM64 for modern Samsung/Android phones.
- Removes unused x86, x86_64 and 32-bit ARM native libraries to make the APK much smaller.
- Sets NODE_ENV=production.
- Verifies APK ZIP integrity.
- Verifies the APK signature using Android apksigner.
- Prints package metadata using aapt.
- Prints the APK checksum and final size before upload.
- Uses setup-java v5.

Upload main.yml into .github/workflows/ and replace the existing main.yml, then commit.
