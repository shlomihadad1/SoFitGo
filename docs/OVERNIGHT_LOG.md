# Overnight work log (26.10.2026)

The owner approved local work only: edits, tests, builds, local commits, restarting local test servers, and git bundles that have been checked for secrets.

**Not approved:**
- pushing anything;
- publishing or changing the live site;
- changing main, netlify-live, netlify-next or Supabase;
- enabling paid services, weakening security, deleting user data, or exposing secrets.

## How to resume after a break
1. `cd /home/claude/fit30-m10-dev && git status && git log --oneline origin/fix/default-cuisine..HEAD`
2. Build:
   ```
   NODE_PATH=/opt/npm-tools/node_modules node tools/build.js
   node tools/tutorials_build.js
   NODE_PATH=/opt/npm-tools/node_modules node tools/build.js
   ```
   Re-record the tutorials whenever the build id changes. `rc1_test` checks that they match.
3. Test servers: run each in the background, then check that each one serves the current build (`curl http://localhost:PORT/sw.js`).
   ```
   python3 -m http.server 8096 -d dist/pwa
   python3 -m http.server 8091 -d dist/pwa
   ```
4. Local Postgres for the RLS and account tests: `sh tools/pg_local.sh`.
5. Full regression: `bash tools/run_all.sh`. It takes about 45 minutes, and every suite must report `exit=0`.
6. Find the next open task in the "Progress" list below.

## Restoring from a bundle (no push needed)
The bundle depends on the commit `origin/fix/default-cuisine` (49ce1e9 at the start of the night).
```
git clone --branch fix/default-cuisine https://github.com/shlomihadad1/SoFitGo.git
cd SoFitGo
git fetch /path/sofitgo-local-<hash>.bundle fix/default-cuisine:restored
```

## Progress
| # | Task | Status | Commit | Tests |
|---|---|---|---|---|
| 0 | Secure existing work | done: 7 commits scanned for secrets (none); bundle `sofitgo-local-891fc3b.bundle` restored into a fresh clone with the identical tree `1a7660a2b429`, and sent to the owner | — | — |
| 1 | SLL-42 part 2: app-generated changes | done → SLL-42 verified-complete | (see git log) | e2e_changelog 28; stageA/B/F/H1, e2e_stageB/F/H1, savefail, m11_sync, m9_identity, now: all pass |
| 2 | SLL-28: data provenance labels | done → verified-complete | (see git log) | e2e_provenance 19; activity_test, e2e_activity, m12_gate, m10_ux, m8, m11_sync, now, e2e, stageH1, m11_meals, beta, rc1, shell, i18n, recipe_gate, food_global, content, menu_structure: all pass |
| 3 | SLL-35: data-saving mode | done → verified-complete; **bug found and fixed:** the SLL-28 labels were smaller than the 40×40 px minimum touch target (caught by e2e_rc1_layout on all 7 sizes); now a transparent ≥40×40 tap area around a small visible label | (see git log) | e2e_lowdata 17, e2e_provenance 20, e2e_rc1_layout 17, content, m10_ux, shell, beta, changelog, stageA, activity, m12_gate, e2e, m8, stageH1, build_check: all pass |
| 4 | SLL-25: weekly reset | done → verified-complete; **bug found and fixed during testing:** undo rewrote the plans store even when the reset had not touched it (it created an empty plans record); undo now restores only the stores that changed | (see git log) | e2e_reset 16, grocery, stageG (+unit), m11_meals, meal_journal, planb_feedback: all pass |
| 5 | SLL-40: preference presets | | | |
| 6 | SLL-21: in-app reminders, quiet hours | | | |
| 7 | Quality pass + final regression + report | | | |

## Decisions taken without the owner (safe defaults, reversible)
(each entry: what, why, how to change)
- **SLL-42, what counts as an app change:** only the automatic calorie/protein targets. The automatic water target follows each day's workout, so logging it would produce daily noise rather than real changes. To change this: add a path to `Core.trackAuto`.
- **SLL-42, merge window:** 2 minutes, the same for user and app entries. To change it: `CHANGE_MERGE_MS` in store.js.
- **SLL-28, label wording:** the gate's "לפי ההגדרות שלך" became the shared "לפי הנתונים שלך" (same meaning, one word everywhere). Workout-duration sentences keep "(הערכה)" as text, because a tappable label inside the version buttons would nest one interactive element in another.
- **SLL-35:** "follow the browser" is stored as `display.lowData = null`. Changing another display setting keeps it that way; only the switch itself sets true/false. Thumbnails inside links get no load button, because a button inside a link is invalid and the link opens the exercise anyway.
- **SLL-25, what the reset covers:** shopping marks (pre-ticked), own bought items (not pre-ticked), and a pending menu update (not pre-ticked). Past workouts are never changed (history rule); missed sessions are a link only. To change the defaults: the `def` flags in `resetItems()`.
- **Testing per feature:** focused suites after each change, local commit as a recovery point, then the full regression on the final tree (it takes ~45 min, so not after every feature). Each commit message says which tests ran.

## BLOCKED (needs the owner)
- SLL-02 Minimum Mode: content, durations, and whether it keeps the streak.
- SLL-33 "shopping day": explicit setting or inferred.
- SLL-07 pre-workout question.
- Netlify linking; push approval; Android key (is the APK installed anywhere?).
