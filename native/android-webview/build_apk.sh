#!/bin/sh
# SoFitGo beta — Android test APK (sideload). Run from the repo root after `node tools/build.js`:
#   ANDROID_HOME=/path/to/sdk SOFITGO_KEYSTORE=/path/beta.jks SOFITGO_KEYSTORE_PASS=... sh native/android-webview/build_apk.sh
# Needs: JDK 17+, Gradle 8.13+, Android SDK platform 35 + build-tools 35. The keystore stays OUTSIDE the repo; keep it — every
# later update must be signed with the same key, or Android refuses it (and uninstalling to install would delete the app's data).
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd); APP="$ROOT/native/android-webview"
[ -f "$ROOT/dist/pwa/index.html" ] || { echo "dist/pwa missing — run node tools/build.js first"; exit 1; }
[ -n "${SOFITGO_KEYSTORE:-}" ] || { echo "SOFITGO_KEYSTORE not set (path to the beta signing keystore)"; exit 1; }
BUILD=$(grep -o "[0-9a-f]\{10\}" "$ROOT/dist/pwa/sw.js" | head -1)
COMMIT=$(git -C "$ROOT" rev-parse --short HEAD)
export SOFITGO_VERSION_CODE=${SOFITGO_VERSION_CODE:-$(git -C "$ROOT" rev-list --count HEAD)}
export SOFITGO_VERSION_NAME=${SOFITGO_VERSION_NAME:-0.6.0-beta+$BUILD}
rm -rf "$APP/app/src/main/assets/www"; mkdir -p "$APP/app/src/main/assets"; cp -R "$ROOT/dist/pwa" "$APP/app/src/main/assets/www"
# local-only build: the accounts switch stays empty (no live backend from the test app)
grep -q "supabaseUrl: ''" "$APP/app/src/main/assets/www/sofitgo-config.js" || { echo "sofitgo-config.js is not empty — refusing to bundle a backend config"; exit 1; }
cd "$APP" && gradle --no-daemon -q assembleRelease
OUT="$ROOT/dist/android/sofitgo-beta-$BUILD-$COMMIT.apk"; mkdir -p "$ROOT/dist/android"; cp "$APP/app/build/outputs/apk/release/app-release.apk" "$OUT"
echo "APK: $OUT (versionCode $SOFITGO_VERSION_CODE, versionName $SOFITGO_VERSION_NAME)"
