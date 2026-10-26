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
| 5 | SLL-40: preference presets | done → verified-complete (was missing) | (see git log) | e2e_presets 14, stageB, m9_identity, changelog, m11_meals, m12_gate, beta: all pass |
| 6 | SLL-21: in-app reminders, quiet hours | done → verified-complete | (see git log) | e2e_reminders 22 (fixed clocks; two weak assertions found in my own draft and replaced before commit); e2e, now, shell, m10_ux, rc1_layout, beta, changelog, stageA (e2e+unit), rc1, build_check: all pass |
| 6b | SLL-24: offline travel pack (chosen next from the backlog: P2, no decision, no content review) | done → verified-complete; **defect found:** the build stripped the photo sizes from the media data, so the pack could not show its download size. The small-image size is now kept (+5 KB first load, still under budget) | (see git log) | e2e_offline_pack 9 (SW on, real outage), build_check, m8, sw_shell, rc1_layout, content, stageA, lowdata, content_coverage: all pass |
| 7a | Quality pass: accessibility + double actions | done. **Bugs found and fixed:** (1) 5 form fields had no label (placeholder only): steps on home, add item on the shopping list, extra equipment in the profile, step target, journal date; (2) a double tap on "הוספה" in the shopping list deleted the item just added, because the second tap landed on its new "מחיקה" button; destructive controls now ignore taps during their first 400 ms on screen; (3) async actions could run twice on a double tap; they now ignore taps until finished (aria-busy) | (see git log) | e2e_a11y_sweep (25 screens × he/en), e2e_double_tap 9, plus 20 suites using these actions (grocery, meal_journal, stageB…F, e2e, stageG/H1, m8, m10_ux, m11_meals, m12_gate, activity, beta, changelog, reset, fridge, builder): all pass |
| 7b | Quality pass: empty/edge states + LTR overflow | done, no defect found (e2e_text_sanity 8) | cb229e8 | — |
| 7c | SLL-32 meal prep (from the backlog review) | done → verified-complete. **Food-safety defect fixed:** a batch could cover meals up to 14 days after cooking, although the same screen says cooked food keeps 3–4 days. Batches and repeated dishes are now split into sessions of at most 3 days | (see git log) | stageG_test 52 (+5), e2e_grocery 45, stageG e2e, reset: all pass |
| 7d | SLL-20 Progress Story (from the backlog review) | done → verified-complete | (see git log) | e2e_story 7, stageG unit+e2e, a11y_sweep, text_sanity, reset, provenance: all pass |
| 7e | SLL-12 Friction Radar (was missing) | done → verified-complete | (see git log) | e2e_friction 13 (one weak assertion in my draft replaced), text_sanity, a11y_sweep, m10_ux, stageA: all pass |
| 7 | Quality pass + final regression + report | | | |

## Full regression checkpoints
| Commit | Build | Result |
|---|---|---|
| 4b2bbfa (after SLL-42/28/35/25/40/21) | a9a81b64f7 | `bash tools/run_all.sh`: **76/76 suites exit 0**, artcheck 2/2, 27,277 checks passed, 0 failed |

## Decisions taken without the owner (safe defaults, reversible)
(each entry: what, why, how to change)
- **SLL-42, what counts as an app change:** only the automatic calorie/protein targets. The automatic water target follows each day's workout, so logging it would produce daily noise rather than real changes. To change this: add a path to `Core.trackAuto`.
- **SLL-42, merge window:** 2 minutes, the same for user and app entries. To change it: `CHANGE_MERGE_MS` in store.js.
- **SLL-28, label wording:** the gate's "לפי ההגדרות שלך" became the shared "לפי הנתונים שלך" (same meaning, one word everywhere). Workout-duration sentences keep "(הערכה)" as text, because a tappable label inside the version buttons would nest one interactive element in another.
- **SLL-35:** "follow the browser" is stored as `display.lowData = null`. Changing another display setting keeps it that way; only the switch itself sets true/false. Thumbnails inside links get no load button, because a button inside a link is invalid and the link opens the exercise anyway.
- **SLL-25, what the reset covers:** shopping marks (pre-ticked), own bought items (not pre-ticked), and a pending menu update (not pre-ticked). Past workouts are never changed (history rule); missed sessions are a link only. To change the defaults: the `def` flags in `resetItems()`.
- **SLL-40, preset values:** יום עבודה = workout ≤30 min, prep ≤20 min; סוף שבוע = ≤45 min, no prep limit; בלי בישול = prep ≤15 min; שקט = no jumping; חדר במלון = ≤30 min + no jumping (with a link to travel mode). Presets never touch equipment, the plan or the menu. To change the values: `PRESETS` in screens_beta.js.
- **SLL-21 defaults:** everything off until the user turns it on. Workout from 18:00, meals from 20:30, water by pace, weigh-in off (Friday 08:00 when on), quiet hours 22:00–07:00. Reminders are in-app only; for alerts while the app is closed there is the existing calendar export. To change the defaults: `C.REM_DEF` in core.js.
- **SLL-24:** the pack covers the trip dates, or the next 14 days when no trip is set, and only small (480 px) photos. Videos are not packed (size). To change this: `packList()` in screens_m8.js.
- **Double-tap guard:** the window is 400 ms, which covers the second tap of a double tap (≤300 ms). It applies only to actions that remove data; undo-type actions (unskip etc.) stay instant. The list is `DESTRUCTIVE` in ui.js.
- **SLL-20 interpretation rules:** ≥80% "עקבי"; 50–79% "רוב האימונים בוצעו"; <50% "קשה להתמדה" with a Plan B link; fewer than 4 days of nutrition logging means "few days". The rules are in `story()` in screens_signature_more.js. No reasons are guessed for missed days.
- **SLL-12 thresholds:** weekday ≥2 misses and ≥50% in 28 days; meal unmarked on ≥8 logged days in 14; water <50% on ≥5 of 7 logged days. Dismissed for 30 days. Thresholds are in `Core.friction`.
- **Testing per feature:** focused suites after each change, local commit as a recovery point, then the full regression on the final tree (it takes ~45 min, so not after every feature). Each commit message says which tests ran.

## BLOCKED (needs the owner)
- SLL-02 Minimum Mode: content, durations, and whether it keeps the streak.
- SLL-33 "shopping day": explicit setting or inferred.
- SLL-07 pre-workout question.
- Netlify linking; push approval; Android key (is the APK installed anywhere?).
