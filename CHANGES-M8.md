# SoFitGo RC5 — M8 batch: changes against M7 `1643870f51`

- **Working copy:** `/home/claude/fit30-rc5-dev` (no git repository).
- **Backup before this batch:** `fitapp/backups/fit30-rc5-dev-before-M8-20261019-1532.tgz`, plus a copy of the M7 ZIP.
- **Not deployed, not pushed.** The RC4 public beta is unchanged.
- **New build:** `cfd6df2f65`.

## Baseline (Stage 1)

- All 7 M7 files listed in the brief exist.
- `sha256sum -c` passes for both M7 ZIPs.
- The dev source is byte-identical to the M7 package's `source/`.
- Rebuilding reproduces build `1643870f51`.
- A full re-run gives **42 suites · 14,713 passed · 0 failed**, which matches the M7 report.
- The Notion brief returned only Notion's JavaScript shell (it needs a sign-in or a browser), so I could not read it. M8 relies on the backlog and the project documentation.

## Product changes

| Area | Change | Why |
|---|---|---|
| Design tokens | `:root` rebuilt as brand primitives (the M8 palette) plus semantic roles. All component colours route through tokens, including translucent ones (`rgb(var(--x-rgb) / a)`). Hero glows removed. `theme-color` and manifest colours are `#0F1115` | M8 §4: one central token system, avoid glow |
| Accessibility | `--faint` changed from `#66757f` to `#8A9096` (3.6 → 5.3:1). `--bad` changed from `#e5675f` to `#F07A72`. Control border `--line-control` is 3.5:1. Focus ring on every control. Reduced motion also stops the new shimmer | WCAG AA. The old faint text failed |
| Forms | Search, email, tel and url fields get the form style. Every field is 16 px or larger | The fridge and recipe search fields were unstyled and 15 px. iOS Safari zooms on fields under 16 px |
| Keyboard | Bottom nav hidden while a text field has focus. It comes back 400 ms after blur, so a tap on a button just above it never lands on a tab | M8 §9. A pure-CSS first attempt caused exactly that tap-through, which `e2e_stageB` and `e2e_stageD` caught. Fixed in the product; the tests were not changed |
| Offline | Offline bar when the browser reports offline, toggled without re-rendering | Offline state (M8 §4) |
| Dashboard | "נצרך היום (מהיומן)" (consumed today, from the journal) next to "נשרף היום — לא נמדד" (burned today, not measured). The plan card's start button becomes secondary when the NOW card already offers it | M8 §6: consumed vs burned, real values only, one primary action |
| NOW card | The avatar and name link to the coach screen. Added a "נסיעה / שינוי בלו״ז" (travel / schedule change) shortcut | Discoverability |
| **Sofit coach** `#/coach` (new) | Rule-based message (same rules as NOW), today's status, links to existing help, chat **disabled with the reason**, and what Sofit does not do | SCR-4 was missing. No fake AI (D-4) |
| **Travel hub** `#/travel` (new) | Destination as a typed label only, plan travel mode, today's short version or skip, food options, **real offline-readiness check** | SCR-12 was missing. No location detection |
| Plan B | "I'm travelling" opens the travel hub | |
| Steps screen | Card explaining why burned calories are not shown | |
| Fridge | Selection summary and a "to results" jump | Results were below a long chip list |
| Active workout | Figure shrinks below 760 px height so the timer stays visible. "Start timer" became an outline button | The timer was hidden under the action bar on short screens. Two lime buttons |
| Programs catalog | Card header class collision fixed. The copy names the real active plan and points to setup. A "פעילה" (active) pill marks the right program. The classic detail no longer claims to be active when another plan is | Pre-existing layout defect since Stage D, and false copy |
| `#/pday` | With no day number it opens today | Showed "not found" |
| Native steps sync | Query one extra day and discard it | The plugin uses `.strictStartDate`, so the first day read low |
| App icons | C2 re-rendered on `#0F1115` with a `#CCFF00` mark. The shape is unchanged; the originals are backed up | Match the tokens. C2 is still not final |
| First-load size | Programs, program and media screens moved to `extra.js`. Coach and travel screens and their CSS live in the chunk | First load 701,701 → **696,998 B** (measured with the avatar: 700,788 B) |

## Files

- **New:**
  - `src/js/screens_m8.js`
  - `tools/e2e_m8.js`
  - `DESIGN-TOKENS.md`
  - `SCREEN-AUDIT-M8.md`
  - `CHANGES-M8.md`
  - `TEST-RESULTS-M8.md`
  - `docs/ASSET-INVENTORY-M8.md`
  - `docs/INNOVATION-PROPOSALS-M8.md`
  - `native/APPLE-HEALTH-VERIFICATION.md`
- **Modified (product):**
  - `src/css/styles.css`
  - `src/js/main.js`
  - `src/js/screens_home.js`
  - `src/js/screens_fridge.js`
  - `src/js/screens_beta.js`
  - `src/js/screens_activity.js`
  - `src/js/screens_programs.js`
  - `src/js/activity_more.js`
  - `src/js/run.js`
  - `src/static/brand/sofitgo/{apple-touch-icon, icon-192, icon-512, icon-maskable-512}.png`
  - `src/data/tutorials_media.js` (re-recorded for the new build)
- **Modified (build/tests):**
  - `tools/build.js`: theme colour; `screens_m8.js` and `screens_programs.js` moved to the chunk.
  - `tools/run_all.sh`: adds `e2e_m8`.
- **Modified (docs):**
  - `docs/HOSTING-AND-NETLIFY-BADGE.md`, which corrects M7.
  - `SAFARI-DEVICE-CHECKLIST.md`
  - `KNOWN-ISSUES.md`
  - `CHANGELOG.md`
  - `native/README-NATIVE.md`: iOS 15+, Xcode 26+, Node 22+, account matrix.
- **Outside the app:**
  - `sofitgo-brand/appicons.js` (icon colours from tokens).
  - `sofitgo-brand/references-m8/`: the 7 supplied images, read-only, plus `SHA256SUMS`.
  - `sofitgo-plan/SOFITGO-MASTER-BACKLOG.md` updated to v3 (v2 backed up).

The exact list is also produced by `diff` against the pre-M8 backup and included in `TEST-RESULTS-M8.md`.

## Test changes

- **No existing test was changed, weakened or deleted.**
- New suite: `e2e_m8`.
- Two assertions inside `e2e_m8` were corrected while it was being written. Both were mistakes in the new test, not changes to existing tests:
  - It checked programs cards with `.card` instead of the catalog's own markup.
  - It counted a toast left over from an earlier step.
