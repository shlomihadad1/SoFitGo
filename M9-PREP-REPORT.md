# SoFitGo: M9 preparation report

- **Date:** 19 October 2026.
- **Starting point:** M8 `cfd6df2f65`.
- **Working copy:** `/home/claude/fit30-m9-dev`, made from the M8 ZIP's `source/`. The M8 dev folder and the M8 ZIPs were not modified, and the M8 ZIPs are now read-only.
- **Not deployed, not pushed, nothing published.** The public RC4 site was not touched.

## 1. M8 integrity verification

| Check | Result |
|---|---|
| `sha256sum -c SoFitGo-RC5-M8-cfd6df2f65.SHA256` | **OK** (`f431d617…686d`) |
| `sha256sum -c SoFitGo-RC5-M8-cfd6df2f65-upload.SHA256` | **OK** (`913f48ed…6512`) |
| Required docs inside the ZIP: `CHANGES-M8.md`, `SCREEN-AUDIT-M8.md`, `TEST-RESULTS-M8.md`, `OWNER-NEXT-STEPS-M8.md` | **All present** |
| M8 dev folder `src/` and `tools/` against the ZIP's `source/` | **Identical** |
| M8 dev `dist/pwa` against the ZIP's `app/` | **Identical** |
| Rebuild from the ZIP's `source/` in the new working copy | **Byte-identical**, build `cfd6df2f65` |
| Backups | `fitapp/backups/fit30-rc5-dev-M8-before-M9-20261019-1637.tgz`, plus a copy of the M8 ZIP and its SHA |
| RC1–RC4 and M7 packages | Checksums still OK. No file in `fit30-rc4-dev` is newer than the M7 ZIP |

## 2. Documentation consistency report

**How I checked:**
- **Automatic:** every `#/route` mentioned in 15 documents was checked against `main.js`, and every referenced path against the file tree. All routes exist. One missing reference was found: see D-6.
- **Manual:** each instruction in the device checklist was compared with the code.

| # | Where | Finding | Fixed? |
|---|---|---|---|
| D-1 | `SAFARI-DEVICE-CHECKLIST.md` | The text-size path was given as "הגדרות ← תצוגה ← טקסט גדול". The real path is **הגדרות ← יחידות ותצוגה ← גודל טקסט ← גדול** | Yes (doc) |
| D-2 | same | It asked for the diagnostics to be repeated "from the Home Screen icon". The installed app always opens at `start_url: './'`, without `?debug=layout`, and `debug-layout.js` is not precached. **Diagnostics are not available in installed mode**, so only visual checks are possible there | Yes (doc) |
| D-3 | same | It expected the hit-test line to show `H1/HEADER`. The code prints a lowercase tag (for example `h1`). Added the "fixed iframes" line as the badge indicator | Yes (doc) |
| D-4 | same + `TEST-RESULTS-M8.md` | It expected VoiceOver to read "לא זמין" for "burned". That `aria-label` is on a plain `span`, which screen readers may ignore; the visible text "לא נמדד…" is what to expect | Yes (doc). App fix proposed as M9-A11Y-1 |
| D-5 | `DESIGN-TOKENS.md`, `KNOWN-ISSUES.md` (M8-1) | Both still described the first, replaced keyboard mechanism (CSS `:has`). The shipped mechanism is `body.kb` with a 400 ms restore | Yes (doc) |
| D-6 | `BETA-INSTALL.md`, `TESTING.md` | Written for RC4 ("RC4 not published", RC4 run instructions). They reference `FIT30-ACCEPTANCE-PLAN.md`, which is in `Fit30-Innovation-HQ/`, not in the package | Marked superseded at the top; original text kept |
| D-7 | `OWNER-NEXT-STEPS-M8.md` | `<build>` placeholder left in a file name | Yes |
| **D-8** | **App copy** (`main.js`, `screens_m8.js`) | **The offline bar said "videos that were not saved won't load", and the travel offline check called cached *images* "tutorial videos saved offline".** The service worker never caches video (range requests go to the network), so both statements were false | **Yes: app text corrected.** It now says videos need a connection and counts images as images. 2 regression checks added to `e2e_m8`. No behaviour changed |
| D-9 | Device checklist (missing items) | It didn't mention that iOS text-size settings don't affect the app, that Safari and the Home Screen app keep **separate storage**, or a persistence check after a restart | Added |

Everything else was checked against the code and found consistent: all routes, the `?debug=layout` loader, the A–D toggles, the offline bar, the "5 מתוך 5" check, the steps "הזנה ידנית" field, "שקילה היום", backup and restore labels, and the coach and travel screens.

## 3. Real-device testing readiness

The checklist is `SAFARI-DEVICE-CHECKLIST.md` (rewritten for M9, about 20 minutes). It covers:
- header (with diagnostics and the A/B comparison), bottom navigation, keyboard, small screen and rotation;
- text scaling and VoiceOver, real-versus-simulated data;
- Home Screen installation, offline, and data persistence.

What is needed before anyone can run it:
1. A **private HTTPS URL** with the M9-prep build (owner upload; I verify anonymous refusal).
2. An iPhone. A small model too, if possible.
3. About 20 minutes.

**No device verification has been done.** Every result so far is from Chromium emulation.

## 4. Netlify badge instructions

See `docs/NETLIFY-BADGE-CHECK.md`. In short:
- **Path:** Project configuration → General → Powered by Netlify badge → **Configure**.
- **Direct link for RC4:** `https://app.netlify.com/projects/regal-starlight-c10c8b/configuration/general#powered-by-netlify-badge`.
- Your earlier iPad photo already shows this section in your account ("The badge is shown on this project — Configure"), on a private project.
- What isn't known yet is whether Configure offers "off" on your plan. Screenshot it and don't save anything.
- Turning it off on RC4 changes the public site, so it needs your explicit approval.

## 5. Graphic asset inventory

See `docs/ASSET-INVENTORY-M9.md`.
- **Usable, provisional:** C2 icons and mark, 192 px Sofit avatar.
- **Low resolution:** the realistic design sheet (faces about 300 px) and the crops.
- **Unapproved concepts:** C1–C4, logo v1, all the supplied boards and renders (italic S, robot coach, mockups with invented data).
- **Missing:** final vector logo, 1024 px app-icon master, high-resolution Sofit portraits (at least 1024 px, same woman, 3–4 poses), rights statement, native launch screen.

## 6–8. M9 backlog, risks, next steps

See `docs/M9-SCOPE.md`.

**Priorities:**
1. Accessibility and usability.
2. Contextual Shortcuts v2.
3. Grocery Loop v3.
4. One-Tap Weekly Reset.
5. Offline Travel Pack (images and text first; video only after an iOS spike).

**Risks:** 12 listed with mitigations (R-1 … R-12). Items that depend on professional exercise review are excluded and named.

## M9-prep build and tests

- **Build:** `377aa1b1cb`. M8 was `cfd6df2f65`. The only app change is the D-8 copy fix; the 12 tutorials were re-recorded for the new build.
- **Full suite** (`sh tools/run_all.sh`, log `reports/logs/run_all-m9prep.txt`): **43 suites · 14,768 passed · 0 failed.**
  - That is M8's 14,766 plus the 2 new D-8 checks.
  - Artcheck 2/0. Soak 3/0.
- **First load** (Chromium, local): 697,007 B for `index.html`, 700,797 B measured with the avatar, against a 712,000 B budget. DOMContentLoaded 166 ms, load 325 ms.
- **Environment:** Playwright Chromium 1.56 with iPhone emulation. **Not Safari, not a device.**
- **Packages:**
  - `SoFitGo-RC5-M9prep-377aa1b1cb.zip` (dev)
  - `SoFitGo-RC5-M9prep-377aa1b1cb-upload.zip` (app at the root)
  - SHA-256 files next to both.
