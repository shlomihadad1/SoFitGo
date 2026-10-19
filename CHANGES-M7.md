# SoFitGo RC5 — M7 batch: changes against RC5 dev `b4243d3e5b`

- **Working copy:** `/home/claude/fit30-rc5-dev`. There is no git repository.
- **Backup before this batch:** `fitapp/backups/fit30-rc5-dev-before-M7-*.tgz`.
- **Not deployed, not pushed.** The RC4 public beta is unchanged.
- **New build:** `1643870f51`.

## Files

| File | What changed and why | Requirement |
|---|---|---|
| `tools/build.js` | **Service worker:** a navigation response replaces the cached shell only if it is `200`, not a redirect, of type `basic`, html, and contains `window.FIT30_BUILD=`. The build id now also covers `tools/build.js`, so service-worker changes change the id. New on-demand chunk `extra.js`, precached for offline use and inlined in the single-file build | P0-F |
| `src/js/store.js` | `save()` returns true/false. If storage worked at start and a write fails, the in-memory data rolls back to what is stored and a `fit30:savefail` event is sent. The **new-profile** step target is `null` instead of 10,000 | F-8, MOV-2 |
| `src/js/main.js` | Shows a specific save-failure message. `extraLoading()` loads the new chunk. New routes: `#/activity`, `#/fridge`, `#/planb`, `#/feedback`; `#/shopping` now also loads from the chunk. No service worker inside the native app. Navigation labels come through i18n | F-8, M8 |
| `src/css/styles.css` | **Shell:** `.top` uses `top: 0` with `padding-top: env(safe-area-inset-top)`. The `body::before` strip is removed. Added spacing and type tokens, and styles for the grocery states | P0-E, BRD-3 |
| `src/js/debug_layout.js` | Hit test on the header title. Toggle **B** = RC4 shell, for comparing on a device | P0-E |
| `src/js/activity.js` (new, main bundle) | Step provenance (`day`, `label`), personal target history (`targetOn`, `setTarget`), manual entry labelled `user`, environment detection, health state | P0-3, MOV-2, MOV-6 |
| `src/js/activity_more.js` (new, chunk) | Imports measured data (idempotent replace; 0-buckets ignored); native connect and sync through `Capacitor.Plugins.Health` (`isAvailable`, `requestAuthorization`, `checkAuthorization`, `queryAggregated` daily sum); MoveScore v0; target suggestion | P0-3, MOV-5, MOV-7 |
| `src/js/screens_activity.js` (new, chunk) | Steps screen: data source, honest status, personal target, MoveScore, 14-day list with source labels | P0-3, MOV |
| `src/js/core.js` | Daily progress counts steps only when a target exists, using the measured or typed value. The weekly summary uses the same value. **No nutrition or training calculation was changed** | MOV-2 |
| `src/js/signature.js` | The weekly review uses the measured or typed steps value. `clearChecks` keeps the user's own items | MOV-6, INN-08 |
| `src/js/screens_home.js` | Steps card: source label, no progress bar without a target, honest environment line. NOW card: shortcut chips | P0-3, INN-33 |
| `src/js/screens_progress.js` | Steps chart with a personal target and source line. Goals: steps can be empty; no 10,000 fallback; neutral tip text. Link to beta feedback | MOV-2, INN-43 |
| `src/js/screens_signature.js` → `screens_shopping.js` (chunk) | Shopping list moved into the chunk. Grocery v2: at home, not found, bought; the user's own items, with duplicate prevention; copy includes states and user items | INN-08 |
| `src/js/screens_fridge.js` (new, chunk) | Fridge-to-Meal: food-id matching, "without shopping", restrictions respected, oven and blender filters | INN-03 |
| `src/js/screens_beta.js` (new, chunk) | Plan B hub (links to existing actions plus a safe-stop notice); beta feedback (local text, no personal data by default) | INN-07, INN-43 |
| `src/js/screens_nutrition.js` | Entry point: "מה יש במקרר?" | INN-03 |
| `src/js/i18n.js` (new) | `t()` with Hebrew and English tables; `?lang=en` developer preview; dir/lang follow the language | PLT-6 |
| `native/*` (new) | Capacitor 8.5.3 configuration, health plugin pinned to 8.7.0, web-copy script, Info.plist and Android notes, privacy-policy **draft**, README with the device test plan | M13, M14 |
| `docs/*.md` (new) | Hosting and the badge (D-2); nutrition-modes proposal (D-1); AI architecture (D-4) | P0-1, M11, M15 |
| `tools/*` | New tests: `e2e_sw_shell`, `e2e_savefail`, `activity_test`, `e2e_activity`, `e2e_grocery`, `e2e_fridge`, `e2e_planb_feedback`, `e2e_i18n`, `recipe_gate`. Updated: `e2e_shell` (title-based, env() mismatch simulation), `run_all.sh` | tests |

## Test changes, and why the old assertion no longer applies

- **`e2e_shell`:** "header box top ≥ inset" was replaced by "header **title** below the status-bar area, fully visible and not covered".
  - The old assertion encoded RC4's structure, a header pushed down under a separate strip.
  - The requirement is that the content is visible.
  - Added: a simulated env() mismatch. RC4 fails it 3 times; RC5 passes.
- **`recipe_gate`:** "fewer than 2 steps = FAIL" was replaced by "0 steps = FAIL; 1 step on a cooked dish = WARN".
  - Assembled snacks and add-ons legitimately have one step.
  - The rule changed in a new tool, before it was ever released.
- **`e2e_activity`:**
  - The "not enough data" check now runs after a target is set. With no target, the correct message is "set a target".
  - The test's own setup was reordered, and the product logic did not change.

**No existing test was deleted.**

## Size

| Item | Size |
|---|---|
| First load (`index.html`), RC5 dev before M7 | 703,429 B |
| First load (`index.html`), M7 | **701,701 B** raw / 194,755 gzip (−1,728 raw against `b4243d3e5b`) |
| Measured first load (index plus the coach image, `e2e_stageA`) | 705,491 B, within the 712,000 budget |
| On-demand `extra.js` | 41,717 B raw / 14,344 gzip. Loaded only when one of its screens opens; precached for offline use |
| `sw.js` | 2,946 B |

To stay under the budget, the explain, review, records and shopping screens moved into `extra.js`. They behave the same; on first use they show "טוען…" briefly.

**Regressions found and fixed in this batch:**
- First load went over budget at 712,589 B; fixed by moving screens out of the first load.
- Grocery checkboxes and chips were smaller than 40 px; fixed with a full-row label and 44 px chips.
- The feedback link made a help-link selector match twice; fixed by moving feedback into its own card.

The tests were not changed for any of these.
