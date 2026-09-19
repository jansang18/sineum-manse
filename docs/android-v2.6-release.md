# Android 2.6 — public birthday supplement

- Built: 2026-09-19, from web runtime commit `d17b0ad`.
- Package: `com.jansang.manse`; versionName `2.6`; versionCode `17`.
- Paired native version metadata: `C:/Users/whaak/Desktop/바탕화면/manse/app/android/app/build.gradle`.
- APK: `output/releases/v2.6-people/jansang-manse-people-v2.6-release.apk` (12,231,934 bytes).
- SHA-256: `51FF1D70482C1C1916D98B973F939BB54AE5F3DE60B7CD3E05CFF18F9D40B82F`.
- Existing pinned signer verified; APK v2 signature valid; `allowBackup=false`.
- Signed AAB also generated and verified by `scripts/build-protected.ps1`.
- Source mirror, no-cache contract, protected-asset UI regression (360/390/412/768) passed.
- All 29 extracted web assets matched APK entry hashes. The birthday module matched source.
- APK-extracted assets passed birthday integration at 390/884/1280, light and dark (6 cases).
- Standard whole-ZIP extraction encounters case-colliding Android `res/` names on Windows;
  all browser-tested `assets/public/` entries were independently hash-verified afterward.
- No connected Android device: native installation/device operation was not tested.
- Clean Android source assets restored after protected build. Existing saved-data logic unchanged.
