# SoFitGo — native iPhone and Android shell (M13/M14)

> **M8:** step-by-step Apple Health verification, the signing matrix and the code audit are in [`APPLE-HEALTH-VERIFICATION.md`](APPLE-HEALTH-VERIFICATION.md).

**Status: PREPARED, NOT BUILT, NOT TESTED.**

- No `ios/` or `android/` project exists yet. Creating them needs your Mac (Xcode) and Android Studio. That doesn't work in my environment: npm registry access is blocked, and there is no Xcode.
- Nothing here is "connected" or "ready" until it has been installed and tested on a real device.

## Why Capacitor

- The app is one self-contained web build (`dist/pwa`), vanilla JS, with no server. Capacitor wraps that same build in a native app, so there is no rewrite.
- `src/js/activity.js` detects the native platform (`Capacitor.isNativePlatform()`).
- `src/js/main.js` skips the service worker in the native app, because the files are bundled.

## Health plugin choice

| | |
|---|---|
| Plugin | `@capgo/capacitor-health` **8.7.0**, pinned |
| Licence | **MPL-2.0** (file-level copyleft; using it unmodified as a dependency is fine) |
| Supports | **iOS 15+** (HealthKit; M8: corrected from "14+" — the 8.7.0 podspec and Package.swift set iOS 15.0) and Android (Health Connect). `peerDependencies`: `@capacitor/core >= 8` |
| Steps API used | `isAvailable`, `requestAuthorization({ read: ['steps'], write: [] })`, `checkAuthorization`, `queryAggregated({ dataType: 'steps', bucket: 'day', aggregation: 'sum' })` |
| No double counting | The plugin's native code uses `HKStatisticsCollectionQuery` with `.cumulativeSum` (iOS) and `aggregateGroupByPeriod` with `StepsRecord.COUNT_TOTAL` (Android). Both are the platforms' own aggregations, which merge phone and watch data. **Must be confirmed on a device with a watch.** |
| Not covered | Background delivery is not used; data syncs while the app is open. Apple Watch only counts through the Health app. |

Checked on 19 Oct 2026, from the package's `package.json`, `LICENSE`, README, `definitions.d.ts`, `Health.swift` and `HealthManager.kt` on jsDelivr. The latest plugin version is 8.11.12. It is not used yet; upgrade only after checking its changes.

## On your Mac (iOS)

**You need** (M8, from the Capacitor 8 environment page): macOS, **Xcode 26.0 or newer**, Xcode Command Line Tools, **Node 22+**, Swift Package Manager (Capacitor 8 default), and an Apple ID.
- Installing on your **own** iPhone works with a free Apple ID (development signing; the app expires after 7 days).
- **Which Apple account is needed for what is in `APPLE-HEALTH-VERIFICATION.md` §2** (M8 corrects the M7 line "HealthKit needs the paid program": the Simulator needs no paid membership, and on-device HealthKit with a free personal team is unconfirmed rather than ruled out). TestFlight and the App Store need the paid Apple Developer Program (decision D-6).

**Steps:**
1. Build the web app from the project root: `node tools/build.js`
2. `cd native && npm install`
3. Set `appId` in `capacitor.config.json`. This is the bundle id, for example `com.yourname.sofitgo`. It is permanent once published, so it's your decision.
4. Create and open the iOS project: `npx cap add ios`, then `npm run ios` (copies the web build and opens Xcode).
5. In Xcode: Signing & Capabilities, choose your team, add **HealthKit**. Paste the keys from `ios-additions/Info.plist.additions.xml` into `Info.plist`.
6. Run on the iPhone (USB, or Wi-Fi after the first pairing).

## Android

1. `npx cap add android`, then `npm run android`. This opens Android Studio.
2. Follow `android-additions/README.txt`. A privacy policy is required; there is a draft in `privacy-policy-draft.html` for you to approve.
3. Run on a phone with Health Connect.

## Device test plan for P0-3

Record the device, iOS/Android version, app build and screenshots for each step.

| # | Step | Expected result |
|---|---|---|
| 1 | Open "צעדים ו־MoveScore" | Pill "אפליקציית iPhone"; Apple Health shows "לא מחובר"; a connect button is shown |
| 2 | Tap connect, then **Deny** | iOS: "הקריאה הצליחה אבל לא התקבלו צעדים" (iOS does not reveal denial). Never "מחובר". Manual values unchanged |
| 3 | Settings → Health → SoFitGo → allow Steps, then "חיבור" again | "מחובר — הקריאה האחרונה הצליחה". The last 14 days are labelled "נמדד · Apple Health" |
| 4 | Compare today's steps with the Health app | Same number, ± live updates |
| 5 | With an Apple Watch: walk with phone and watch together, then sync | No doubled number compared with the Health app |
| 6 | Sync twice | Same value; nothing adds up |
| 7 | Airplane mode, then open the app | Last values and the last-sync time are shown; no error loop |
| 8 | Revoke permission in Settings, then sync | No new data; the screen does not claim fresh data |
| 9 | "מחיקת הצעדים שיובאו" | Measured values removed; manual values stay |

Android: the same steps. At step 2, Android reports the denial: "ההרשאה לא ניתנה".
