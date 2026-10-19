# Test results: M9 logo and personal greeting

- **Build:** `e81b508e27`.
- **Run:** 19 October 2026.
- **Environment:** Playwright **Chromium 1.56** with iPhone emulation.
- **Not tested here:** Safari, a real device, the native app.

## Full regression (final)

- **Command:** `sh tools/run_all.sh`. Log: `reports/logs/run_all-m9-identity-final.txt`.
- **Result:** **44 suites · 14,850 passed · 0 failed.** Artcheck 2/0. Soak 3/0.
- **Compared with M9-prep** (43 suites / 14,768):
  - new suite `e2e_m9_identity`: 81 checks;
  - `build_check`: +1, for the new test file's syntax.

## Failures during the batch

| Run | Failure | Cause | Fix |
|---|---|---|---|
| First full run (`run_all-m9-identity.txt`): 14,849 / 1 | `e2e_m8` "background, card surface, card border … resolve to the tokens" | The test read the **first** `.card` on Home. After the M9 reorder, that is the plan card (`.card.hero`), which by design uses a gradient and `--line-strong` | The test now selects a plain card (`.card:not(.hero)`). Token values are unchanged. Reason documented in `CHANGES-M9-IDENTITY.md` §6 |
| While writing `e2e_m9_identity` | "one lime action … Sofit's card secondary" | The new test assumed today is a workout day; on a rest day the next step is a meal | The workout case is now rendered directly from the model. The rest-day case still checks that there is at most one lime action |

## `e2e_m9_identity` (81/0): what it proves in Chromium

| Area | Checks |
|---|---|
| **New user** | Greeting is "שלום, בוא נתחיל" and is first on Home. The avatar is the SoFitGo symbol, never Sofit's portrait, in a circle with `#181B22` background and `#2A2E39` border. It is decorative, and the symbol is square and not upscaled |
| **Name** | Saved trimmed. The greeting becomes "שלום, שלומי". HTML in a name is shown as text. Clearing it returns the generic greeting |
| **Photo** (generated test pattern, not a person) | Stored as a small JPEG in `fit30.avatar`. It replaces the fallback automatically, with `object-fit: cover`. **Same 44×44 box before and after.** A 400×200 source is centre-cropped to 200×200 (not stretched, not upscaled). The backup has the name but not the photo. A corrupt name is rejected on restore. Removing the photo brings back the fallback. "Delete all" deletes the photo |
| **Coach separation** | Order is greeting → plan → progress → Sofit. Label is "Sofit — המאמנת הדיגיטלית". The greeting never says "Sofit". Sofit's portrait and "next step" stay in her card. No "Online"/"מחוברת" on Home. At most one lime action; Sofit's "start" is secondary on Home and primary on the coach screen |
| **Header logo** at 430 / 390 / 360 / 320 px × Home, Nutrition, Tracking | Wordmark from 360 px, symbol below. Aspect ratio kept. No overlap with the title or settings. No sideways scroll. Accessible name "SoFitGo" |
| **Offline** | Both logo files are in the service-worker precache |

## Size and performance (local, Chromium)

| | Value |
|---|---|
| `index.html` | 701,807 B |
| First load measured | 707,545 B and 709,467 B in two runs (budget 712,000) |
| DOMContentLoaded / load | 183 / 341 ms |
| Logo files | Wordmark 3,870 B; symbol 1,948 B |

## Not verified

- **On a real iPhone:** logo sharpness and edges on the OLED screen, the greeting with large text, choosing a photo from the iOS photo picker (including HEIC), and the photo surviving an app restart. Add these to `SAFARI-DEVICE-CHECKLIST.md` §6 when testing.
- **Your screenshot from 22:27** is real-device evidence for one point only: on Home, the header is fully visible at rest, in a non-Safari iOS browser, on an M7/M8 build. It also shows Netlify's badge covering **בית** and **לוח**.

## Screenshots

`brand/preview/m9-home-before-after-chromium.png`. Labelled: Chromium, iPhone emulation, not Safari; the photo is a generated test pattern.
