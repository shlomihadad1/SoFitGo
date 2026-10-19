# SoFitGo RC5 (dev) — test results, M7 batch

- **Build:** `1643870f51`.
- **Run on:** 2026-10-19, with Node, plus Playwright Chromium emulating iPhone SE / 13 / Pro Max and iPad.
- **Not tested:** Safari, any real device, the native app.

## Full run (executed now)

- **Command:** `sh tools/run_all.sh`. Log: `reports/logs/run_all-rc5c.txt`.
- **Result:** **42 suites, 14,713 passed, 0 failed.** Plus artcheck 2/0, and soak (3 scenarios, 910 simulated days) 3/0.
- **New suites in M7:**

| Suite | Result | What it covers | Against RC4 / earlier RC5 |
|---|---|---|---|
| `e2e_sw_shell` | 9/0 | The host returns 401, 500 or 302; then, offline, the cached app (not the login or error page) loads | RC4: 3 failures |
| `e2e_savefail` | 8/0 | A storage write fails: a specific error is shown, data rolls back to what is stored, nothing phantom appears | RC4: fails, then crashes |
| `activity_test` | 140/0 | Default target, existing 10,000 kept, target history, provenance, idempotent re-sync, 0-buckets, MoveScore boundaries, missing data, rest days, demo/test exclusion, trend, per-day targets, DST/midnight. Run in 5 time zones | — |
| `e2e_activity` | 23/0 | Honest web status, no default target, labels, MoveScore states. **Simulated** native bridge: connect only after a read, re-sync, iOS empty read, Android denial, plugin error | — |
| `e2e_shell` | 85/0 | Header title visible and uncovered on 6 screens × insets 0/47/59; nav tabs on top; env() mismatch simulation; diagnostics | RC4: 4 failures (3 mismatch + diagnostics). Live RC4 on Netlify: the badge covers 3 tabs |
| `e2e_grocery` | 13/0 | States, user items, duplicates, clear keeps user items, persistence, undo | — |
| `e2e_fridge` | 12/0 | Ranking, "without shopping", restrictions, equipment, restaurant exclusion, persistence | — |
| `e2e_planb_feedback` | 16/0 | Shortcuts, safe stop, 6 working links, no data change; feedback with no personal data; copy = preview | — |
| `e2e_i18n` | 8/0 | Hebrew unchanged; `?lang=en` gives LTR; same keys in both tables; no sideways scroll | — |
| `recipe_gate` | 144/0 | 21 recipes carry extra warnings (missing equipment, single step on a cooked dish, an identical ingredient set). All 144 lack a source field | — |

- **Local deploy check:** `deploy_check http://localhost:8096/`: 30/1. The one failure is HTTPS, which is expected on a local server.

## Failures during the batch, and their resolution

In the first full run (`run_all-rc5b.txt`), 3 suites failed. All three were **real regressions from this batch**. They were fixed in the product; **the tests were not changed**:

| Suite | Failure | Fix |
|---|---|---|
| `e2e_stageA` | First load 712,589 B, over the 712,000 budget | Moved explain, review, records and shopping into `extra.js` |
| `e2e_rc1_layout` | New grocery checkboxes 22×22 and chips 32 px tall, under the 40×40 tap target | Full-row label; chips 44 px |
| `e2e_rc1` | Locator `[data-help-link] a` matched 2 links after the feedback link was added to that card | Feedback moved into its own card |

## Test changes (with reasons)

The full reasons are in `CHANGES-M7.md`:
- **`e2e_shell`:** the header check is now based on the title, not the header box.
- **`recipe_gate`:** single-step rule for no-cook items.
- **`e2e_activity`:** the test's own setup order changed.

## Not tested

- Real iPhone Safari (P0-E/P0-2).
- Real HealthKit or Health Connect.
- The native builds.
- VoiceOver.
- Netlify after the badge is removed (needs hosting decision D-2).
