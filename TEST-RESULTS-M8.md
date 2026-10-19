# SoFitGo RC5 (dev) — test results, M8 batch

- **Build:** `cfd6df2f65` (M7 was `1643870f51`).
- **Run on:** 19 October 2026.
- **Environment:** Node, plus Playwright **Chromium 1.56** emulating iPhone SE / 13 / Pro Max and iPad.
- **Not tested:** Safari, any real device, the native app.

## Full run (executed now)

- **Command:** `sh tools/run_all.sh`. Log: `reports/logs/run_all-m8-final.txt`.
- **Result:** **43 suites · 14,766 passed · 0 failed.** Artcheck 2/0. Soak: 3 scenarios, 910 simulated days, 3/0.
- **Baseline before any M8 change:** 42 suites · 14,713 passed · 0 failed (`run_all-m8-baseline.txt`). This reproduces the M7 report exactly.
- **The difference:** one new suite (`e2e_m8`, 51 checks) and 2 more `build_check` checks for the new source files.
- **Local deploy check:** `deploy_check http://localhost:8096/` gives 30/1. The one failure is "URL uses HTTPS", which is expected on a local server.

## New suite: `e2e_m8` (51/0)

| Group | What it proves (in Chromium) |
|---|---|
| Design tokens | The 6 M8 tokens are on `:root`. Body, card, border, text and primary button resolve to them. `theme-color` and the manifest use `#0F1115`. No old palette literal remains in the shipped CSS |
| Contrast | Computed in the page: text, muted, faint, bad, warn, good and accent on a card are all ≥ 4.5:1. Primary button text ≥ 4.5:1. Field border ≥ 3:1 |
| Dashboard | "Consumed" equals the journal total (0, then the exact value after marking a meal). "Burned" shows no number and says "not measured". Only one lime "start workout" |
| Coach | Message built by the NOW rules. Labelled "not an AI chat". Chat input and send are disabled. No "online" or credential claim. Approved avatar, not upscaled. A tap does nothing. Tapping the NOW avatar opens the coach |
| Travel | Says location is not detected. Destination saved as a user-entered label. No plan, menu or workout data changes. **Zero geolocation calls** (API stubbed and counted). Opens the existing travel-mode sheet. Offline check is **not ready** without a service worker. Plan B links here |
| Forms | Every visible field on 12 screens is ≥ 16 px. Fridge search styled. Nav hidden while a field is focused and back after blur. **Tapping "save" exactly where the nav sits, while focused, saves and does not open a tab.** Fridge "to results" jump works |
| Every control works | On 26 screens: 0 buttons without a handler, 0 links to missing screens, 0 page errors. `#/pday` opens today. The lazy programs screen renders |
| Offline | The offline bar appears and disappears with the connection |
| Reduced motion | Shimmer and toast animation are off |
| Real service worker | With the shell cached and controlling the page, the offline check reports **ready, 5 of 5** |
| Native boundary (**simulated bridge**) | The query starts one day early; the extra day is discarded and the window's first day is imported |

## Failures during the batch, and their resolution

| Seen in | Failure | Cause | Fix |
|---|---|---|---|
| `build_check` | "no secrets in build" | My new CSS selector `input[type="password"]` contains the word "password". The app has no password fields | Selector removed from the product. **Test unchanged** |
| `rc1_test` (12) | Tutorials recorded from an older build | The build id changed | Re-recorded all 12 tutorials from `cfd6df2f65` (`tutorials_build-m8.log`: 12/12) |
| `e2e_stageB` (1), `e2e_stageD` (2) | Profile and quick-weight saves did not persist | **A real regression from M8's first keyboard rule** (CSS `:has`): blurring the field on pointer-down brought the nav back under the finger, so the tap hit a tab | Replaced with a delayed restore (400 ms) in `main.js`, and added a regression check to `e2e_m8`. **Tests unchanged** |
| `e2e_stageA` (2) | Version-upgrade test served the wrong build | **My test environment:** I had a temporary server on port 8097 (to compare with M7) and the test needs that port | Stopped my server; passes. Not a product issue |
| First-load budget | After the first CSS changes: about 712,400 B against the 712,000 budget | Growth from the new styles | Moved programs, program and media screens into `extra.js`, and moved the coach and travel styles into the chunk. **Budget not raised** |

**No existing test was changed, weakened or deleted.** The two corrections inside the new `e2e_m8` while I wrote it are in `CHANGES-M8.md`.

## Performance (local server, Chromium, from `e2e_stageA`)

| Measure | M7 | M8 |
|---|---|---|
| `index.html`, raw / gzip | 701,701 / 194,755 B | **696,998 / 194,216 B** |
| First load measured (index + avatar) | 705,491 B | **700,788 B** (budget 712,000) |
| Requests at first load | 2 | 2 |
| DOMContentLoaded / load | — | 207 ms / 369 ms |
| `extra.js` (on demand, precached) | 41,717 B | 67,346 B. Now also holds coach, travel, programs and media |
| `sw.js` | 2,946 B | 2,946 B |

## Accessibility findings

- **Fixed:**
  - faint text contrast, 3.6 → 5.3:1;
  - field borders at ≥ 3:1;
  - search fields at 16 px or more (no iOS zoom);
  - visible focus ring on all controls;
  - reduced motion now also covers the shimmer;
  - the "burned" value is a dash with visible text "לא נמדד — אין מקור מדידה מחובר". (M9 doc correction: its `aria-label="לא זמין"` sits on a plain `span`, which screen readers may ignore; the visible text is what VoiceOver is expected to read. Tracked as M9-A11Y-1.)
  - the coach chat uses `disabled` and `aria-disabled`;
  - the fridge results jump moves focus to the results heading.
- **Still open:**
  - VoiceOver (never tested);
  - Dynamic Type and large text on a device;
  - landscape on a device;
  - the keyboard and nav interaction on a real iPhone.

## Not tested

- Real iPhone Safari: header (P0-A), keyboard, input zoom, offline from the home-screen icon.
- Real HealthKit or Health Connect, native builds, VoiceOver.
- H.264 tutorial playback (this Chromium has no H.264 decoder).
- Netlify after any badge change (decision D-2).

## Screenshots

`brand/preview/rc5-m8-screens-chromium.png`. Labelled on the image: *"Rendered in Playwright Chromium 1.56, iPhone 13 emulation — NOT Safari, NOT a real device"*.

## Changed files (diff against the pre-M8 backup)

```
modified  CHANGELOG.md, KNOWN-ISSUES.md, SAFARI-DEVICE-CHECKLIST.md, docs/HOSTING-AND-NETLIFY-BADGE.md, native/README-NATIVE.md
modified  src/css/styles.css, src/data/tutorials_media.js, src/js/{activity_more,main,run,screens_activity,screens_beta,screens_fridge,screens_home,screens_programs}.js
modified  src/static/brand/sofitgo/{apple-touch-icon,icon-192,icon-512,icon-maskable-512}.png, tools/build.js, tools/run_all.sh
modified  src/media/tutorials/* (12 recordings + posters re-recorded; old files replaced)
new       src/js/screens_m8.js, tools/e2e_m8.js, CHANGES-M8.md, DESIGN-TOKENS.md, SCREEN-AUDIT-M8.md, OWNER-NEXT-STEPS-M8.md,
          TEST-RESULTS-M8.md, docs/ASSET-INVENTORY-M8.md, docs/INNOVATION-PROPOSALS-M8.md, native/APPLE-HEALTH-VERIFICATION.md
```
