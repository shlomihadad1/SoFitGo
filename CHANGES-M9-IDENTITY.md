# SoFitGo M9 · brand logo and personal greeting

- **Base:** M9-prep `377aa1b1cb`, which is M8 `cfd6df2f65` plus the honesty copy fix.
- **Working copy:** `/home/claude/fit30-m9-dev`.
- **Backup:** `fitapp/backups/fit30-rc5-dev-M8-before-M9-*.tgz`. The M8 and M9-prep ZIPs are read-only.
- **Not deployed, not pushed.** The public RC4 site is unchanged.

## 1. Supplied logo package: what I found

**Package handling:**
- The package `SoFitGo_Logo_Assets.zip` (SHA-256 `3ac05048…754f`) is kept read-only, together with its extracted files.
- Location: `sofitgo-brand/logo-assets-m9/`.
- Checksums of all files are in `SHA256SUMS-extracted`.
- I read the README first.

| File | Format and size | Finding | Used? |
|---|---|---|---|
| `sofitgo_wordmark_transparent.png` | PNG RGBA, 694×173 | The horizontal wordmark: angular lime symbol, white "Sofit", lime "Go". The white is clean. **The lime parts are only about 77% opaque** (median alpha 197 out of 255), with speckled alpha and a colour of about `#B4F040` instead of `#CCFF00`. On the dark UI that renders as a dull, blotchy olive | **Source** of the cleaned provisional files (below) |
| `sofitgo_wordmark_dark.png` | PNG RGB, 694×173 | The same extraction, flattened on `#0F1115`, with no transparency | No. It would show a visible box on `--surface` |
| `sofitgo_app_icon_concept_crop.jpg` | JPEG, 550×550 | **The crop missed the icon.** It shows mostly an empty dark area and the corner of a rounded tile | No. **The app icon is unchanged** |
| `sofitgo_3d_icon_reference.jpg` | JPEG, 2048×2048 | 3D perspective render | No. A perspective mockup can't be used as an in-app logo |
| `reference_brand_board.jpg`, `reference_3d_logo_mockup.jpg` | JPEG, 2048×2048 | Byte-identical to two images from the M8 message (`ref-app-icon-presentation-2048.jpg`, `ref-logo-3d-chevron-s-2048.jpg`) | No (reference only) |

### What I shipped: provisional, cleaned rasters

| App file | Size | Made from | Where it is shown |
|---|---|---|---|
| `src/static/brand/sofitgo/logo/sofitgo-wordmark-provisional.png` → served as `/sofitgo-wordmark-provisional.png` | 394×84 PNG, 64-colour palette with alpha, **3,870 B** | `sofitgo_wordmark_transparent.png` | Header on top-level screens, **at viewport widths of 360 px and more**, 26 CSS px high (3× sharp) |
| `src/static/brand/sofitgo/logo/sofitgo-symbol-provisional.png` → `/sofitgo-symbol-provisional.png` | 128×128 PNG, **1,948 B** | The symbol part of the same file | Header **below 360 px**, and the user-avatar fallback |

**Cleaning method** (`sofitgo-brand/logo-assets-m9/clean_logo.py`):
1. A 3×3 median filter on the alpha channel removes the speckle.
2. Alpha 24…176 is mapped to 0…255, giving a solid interior with the anti-aliased edge kept.
3. Each pixel is set to the exact token colour of its class: `#CCFF00` (lime) or `#FFFFFF` (white).

**What I did not do:**
- No shape was redrawn or traced.
- No vector file was created.
- Nothing was renamed to look like SVG.

**Status: PROVISIONAL.** The file names say so, and so do the comments in the code and the docs. These are replaced by exports of the original vector logo when it is delivered, using the same file names, so no code changes are needed.

**Not changed:**
- **App icons:** there is no clean square source, so the C2 icons stay as they are.
- **Glow, stretching, cropping:** none added. The wordmark has a fixed height and its width follows the image's own aspect ratio; `e2e_m9_identity` checks the shown ratio against the natural ratio.

### Where the logo appears

- **Top-level screens** (no back button): Home, Calendar, Workouts, Nutrition, Tracking and Settings.
  - **360 px and wider:** the wordmark, then the screen title.
  - **Under 360 px:** the symbol only.
  - A `<picture>` element fetches only the version that is shown.
- **Sub-screens:** the back arrow, as before.
- **Legacy brand build** (`FIT30_BRAND=fit30`): the C2 mark, as before.
- **Single-file artifact build:** the two images are embedded as data URIs.
- **Offline:** both files are precached by the service worker.

## 2. Personal greeting and avatar

| State | Greeting | Avatar |
|---|---|---|
| No name, no photo | **"שלום, בוא נתחיל"** | SoFitGo symbol, circle, `#181B22` background, `#2A2E39` border |
| Name saved (for example "שלומי") | **"שלום, שלומי"** | Symbol |
| Photo saved | (name or generic) | **The user's photo**, `object-fit: cover`, in the same 44×44 circle, so there is no layout shift |
| Photo removed | — | The symbol returns. Removing it offers undo |

**Name:**
- New optional field "שם פרטי (רשות — מופיע רק בברכה במסך הבית)". It is the first field of the shared "פרטים אישיים" (personal details) section, so it appears both in **Profile** and in **setup step 1**.
- Stored as `profile.name`: trimmed, at most 30 characters, `null` when empty.
- It is never invented and always shown as text, never as HTML.
- It is included in backups. Restore rejects a corrupt value.

**Photo:**
- New card in **Profile**: "תמונת פרופיל (רשות)" (profile photo, optional), with choose or replace and remove.
- The image is decoded on the device, centre-cropped to a square (never stretched), downscaled to 256 px or less, and saved as JPEG 0.85.
- It is stored in the new key `fit30.avatar`.
- **Not in backups**, the same rule as progress photos, and the card says so.
- Deleted by "delete all data".
- A failed save shows the specific F-8 message "תמונת הפרופיל" (profile photo).

**The avatar is decorative** (`aria-hidden`); the greeting text carries the meaning. It is not a button and adds no navigation. **Sofit's portrait is never used for the user.**

## 3. Sofit stays separate from the user

- **Home order** is now:
  1. greeting (you);
  2. plan dashboard;
  3. progress;
  4. **Sofit's card**.

  Without a plan, the order is: setup, then the classic day's card, then Sofit.
- **Sofit's card label:** "Sofit · עכשיו" became **"Sofit — המאמנת הדיגיטלית"** (Sofit, the digital coach). It keeps her portrait, the heading "הצעד הבא" (next step), and the same rule-based recommendation.
- **One lime action:** the plan card keeps the lime "התחלת אימון" (start workout). On Home, Sofit's card shows it as secondary. On the coach screen it stays primary.
- **No "Online" or "connected" status** anywhere on Home. Checked by test.

## 4. Size

| | M9-prep | Now |
|---|---|---|
| `index.html` | 697,007 B | 701,807 B |
| Measured first load (`e2e_stageA`) | 700,797 B | **707,545–709,467 B** across two runs (budget 712,000; budget not raised). The range depends on whether the lazy-loaded Sofit image in the coach card is fetched during the measurement. Headroom is now about 2.5 KB, so the next screens must go into `extra.js` |

## 5. Files

- **New:**
  - `src/static/brand/sofitgo/logo/sofitgo-wordmark-provisional.png`
  - `src/static/brand/sofitgo/logo/sofitgo-symbol-provisional.png`
  - `tools/e2e_m9_identity.js`
  - this file
  - `sofitgo-brand/logo-assets-m9/` (package, extracted files, `clean_logo.py`, `derived/`, `SHA256SUMS-extracted`)
- **Changed:**
  - `src/js/store.js`: `profile.name`, the `avatar` key, backup validation.
  - `src/js/screens_plan.js`: name field, photo card, `avatarFromFile`.
  - `src/js/screens_home.js`: greeting, avatar, order, coach label, secondary start.
  - `src/js/main.js`: header logo, save-failure label.
  - `src/css/styles.css`: logo, greeting and avatar styles.
  - `tools/build.js`: copy and precache the logo, `FIT30_LOGO`, artifact data URIs.
  - `tools/run_all.sh`: adds `e2e_m9_identity`.
  - `src/data/tutorials_media.js` and `src/media/tutorials/*`: re-recorded for the new build.

## 6. Tests

The results are in `TEST-RESULTS-M9-IDENTITY.md`.
- **New suite `e2e_m9_identity`:** 81 checks, covering both profile states, photo cropping, no layout shift, escaping, backup rules, order and coach separation, and the logo at 430, 390, 360 and 320 px on 3 screens.
- **One assertion in the new suite was corrected while I wrote it.** It assumed today's plan day is always a workout day; the day of the week decides that. It is now tested directly from the model.
- **One existing test was changed: `e2e_m8`.**
  - **What failed (first full run, 44 suites):** 14,849 passed, 1 failed. The failing check was the design-token test, which read the **first** `.card` on Home.
  - **Why the old assertion no longer applies:**
    - The first card used to be the plain NOW card. After the M9 reorder it is the plan card, which is a `.card.hero`.
    - Hero cards are documented in `DESIGN-TOKENS.md` to use the surface-2 → surface gradient and `--line-strong`.
    - So the test was relying on the order of cards, not on the token rule it was written for.
  - **Fix:** the two lookups now select a plain card (`.card:not(.hero)`). The token values checked are unchanged.
