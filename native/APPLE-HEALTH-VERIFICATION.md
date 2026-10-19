# Apple Health — native verification (M8)

**Status: PREPARED · SIMULATED-BRIDGE TESTED · REAL HEALTHKIT NOT VERIFIED.**

What has been tested so far:
- `e2e_activity` and `e2e_m8` run a **JavaScript stand-in** for the plugin inside Chromium. That checks the app's logic: states, labels, idempotent re-sync and the first-day boundary.
- It proves nothing about HealthKit, iOS permission sheets, the Health app, Apple Watch merging or real devices.

The app shows **"מחובר"** (connected) only after a real read has returned data. A simulated read is not a connection.

## 1. Code audit (done in M8 against the pinned plugin source)

Sources: `@capgo/capacitor-health@8.7.0`, specifically `dist/esm/definitions.d.ts`, `ios/Sources/HealthPlugin/Health.swift`, `package.json`, `Package.swift` and the podspec, all read from jsDelivr on 19 October 2026.

| Check | Finding | Status |
|---|---|---|
| API names and options | `isAvailable()`, `requestAuthorization({read, write})`, `checkAuthorization({read, write})`, `queryAggregated({dataType, startDate, endDate, bucket, aggregation})` → `{samples:[{startDate, endDate, value, unit}]}`. These match `src/js/activity_more.js` | OK |
| Versions | Plugin peer `@capacitor/core >=8.0.0`; app pins Capacitor 8.5.3 (`@capacitor/ios` 8.5.3 needs core `^8.5.0`). Plugin iOS target **15.0**. Latest plugin is 8.11.12 (not adopted; review its changes first) | OK |
| Toolchain | Capacitor 8 needs **Xcode 26.0+** and **Node 22+** ([environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)). M7's README said Node 20+; corrected | Fixed in docs |
| Aggregation and dedupe | iOS uses `HKStatisticsCollectionQuery` with `.cumulativeSum`, anchored at local midnight (`Calendar.current`) with a 1-day interval. HealthKit statistics merge overlapping phone and watch samples, so the app never adds sources itself | OK. **Confirm with a watch on a device** |
| Time zone | Bucket dates are returned as UTC ISO strings. The app converts each one back to the **device's local date** (`new Date(...)` with local getters). That matches the plugin's local-midnight anchor | OK |
| First day of the window | The plugin filters with `HKQuery … options: .strictStartDate`. A walk that starts before midnight and ends after it is dropped, so the first requested day reads low | **Fixed in M8:** the app asks for one extra day and discards it (`e2e_m8` checks this with the simulated bridge) |
| Empty days | The plugin returns no bucket when the sum is nil. The app also ignores 0 buckets, so an iOS "no permission / no data" read never overwrites a value the user typed | OK (by design) |
| Denied permission on iOS | HealthKit does not reveal read denial. The app shows "הקריאה הצליחה אבל לא התקבלו צעדים" (the read worked but returned no steps) and explains it. It never shows "מחובר" | OK |
| Deleted data | If steps are deleted in the Health app, the app keeps the old measured value, because 0 buckets are ignored. The user can delete imported steps on the steps screen | Known limitation (documented) |
| Travel across time zones | Days are keyed by the local date at sync time. A re-sync in a new zone re-buckets the 14-day window and replaces it (idempotent) | **Verify on a device** |
| Entitlement and privacy strings | `Info.plist` needs `NSHealthShareUsageDescription` (draft in `ios-additions/`). The target needs the **HealthKit** capability. No Clinical Records and no background delivery | Prepared; owner approves the wording |
| Bundle id | `capacitor.config.json` still says `OWNER.DECISION.bundle.id`. Xcode cannot sign without a real one | **Owner decision** |

## 2. What needs which Apple account

Each row says how sure I am.

| What you want to do | Apple account needed | Confidence |
|---|---|---|
| Build and run in the **iOS Simulator** on your Mac, including a HealthKit read: the Simulator has the Health app, and Apple documents using HealthKit data there | **None.** Xcode is free, and Simulator builds are not signed for distribution | High for the Simulator in general; **confirm** that Xcode builds with the HealthKit capability without choosing a team. If it asks for a team, add your free Apple ID as a Personal Team |
| Install on **your own iPhone** with development signing | A **free Apple ID** (Personal Team). Apps signed this way expire after **7 days** and must be re-run from Xcode | High for apps in general |
| The same with the **HealthKit capability** on your own iPhone | **Probably a free Personal Team.** A developer on Apple's forum reports building a HealthKit app with free personal teams (the problem they hit was a bundle id clash between teammates). Apple's capability table could not be read in this session | **Unconfirmed.** If Xcode shows "Personal development teams … do not support the HealthKit capability", the paid program is required |
| **TestFlight** (testers install from Apple) | **Apple Developer Program**, paid yearly. Confirm the price on developer.apple.com | High |
| **App Store** release | Apple Developer Program, plus App Store review, a privacy policy, and Health data usage answers | High |

So it is **not** necessary to pay just to see the real HealthKit flow: the Simulator, and probably your own iPhone, can be tested first.

## 3. On the Mac: Simulator first (about 30 minutes)

1. Install Xcode 26 or newer from the App Store, then run `xcode-select --install`. Install Node 22.
2. Unzip the dev package. From `source/`, run `node tools/build.js`.
3. Run `cd native && npm install`. This pins Capacitor 8.5.3 and the plugin 8.7.0.
4. Set `appId` in `capacitor.config.json`, for example `com.<yourname>.sofitgo` (your decision).
5. Run `npx cap add ios`, then `npm run ios`. Xcode opens.
6. In Xcode, select the App target and open **Signing & Capabilities**:
   - choose your team, or a Personal Team;
   - click **+ Capability** and add **HealthKit**. Leave Clinical Records and Background Delivery off.
7. Paste the two keys from `ios-additions/Info.plist.additions.xml` into `ios/App/App/Info.plist`.
8. Pick an iPhone Simulator and press Run.
9. **Add sample steps.** In the Simulator, open the **Health** app → Browse → Activity → Steps → **Add Data**. Add, say, 3,200 for today and 5,000 for yesterday.
   - This is how to create sample steps in the Health app. Apple's Simulator article covers clinical-record sample accounts, not steps.
10. Back in SoFitGo, open "צעדים ו־MoveScore" and run the test plan in `README-NATIVE.md`, steps 1–4 and 6–9. Record what each step shows.

## 4. On your iPhone

Do this after the Simulator works.

1. Connect the iPhone by cable and trust the Mac. On iOS 16 or later, turn on **Developer Mode** (Settings → Privacy & Security).
2. Select the iPhone as the run target and press Run.
   - With a Personal Team, the first launch needs Settings → General → VPN & Device Management → trust the developer.
3. Run the full device test plan in `README-NATIVE.md`, including step 5 (Apple Watch), which can only be tested on a real device.
4. Send back:
   - iPhone model and iOS version;
   - Xcode version;
   - which team type you used;
   - the screenshot of each step;
   - today's number in the Health app next to the number in SoFitGo.

## 5. What "done" means

P0-C counts as **verified** only when all of these hold on a real iPhone:
- Steps 1–9 pass.
- The Health app and SoFitGo show the same daily totals for 3 days.
- With a watch, there is no double counting.
- A denied or revoked permission never shows "מחובר".

Until then, the backlog status stays **PREPARED, NOT CONNECTED**.
