#!/bin/sh
# Copies the already-built web app (../dist/pwa, built by tools/build.js) into native/www for Capacitor.
# The web code is reused as is: in the native app there is no service worker (main.js detects Capacitor) and
# Activity.env() reports the platform, so the steps screen offers Apple Health / Health Connect.
set -e
cd "$(dirname "$0")/.."
[ -f ../dist/pwa/index.html ] || { echo "build first: node tools/build.js (from the project root)"; exit 1; }
rm -rf www && mkdir www
(cd ../dist/pwa && tar cf - --exclude=./sw.js --exclude=./debug-layout.js .) | (cd www && tar xf -)
echo "www ready: $(grep -o "FIT30_BUILD='[0-9a-f]*'" www/index.html)"
