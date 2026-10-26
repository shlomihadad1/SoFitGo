# SoFitGo — release report, 26.10.2026 (overnight local work)

**Status:** a release candidate, fully verified locally on commit `2c9f577` (build `a1c98ddc1a`): 82/82 suites, 0 failed. It is **not production-ready**: the live site has not been updated or verified, and nothing has been pushed.

## 1. What was completed and tested
"Verified-complete" means implemented, with acceptance criteria covered by meaningful tests. The full lists are in `docs/SOFITGO_MASTER_BACKLOG.md`.

| SLL | Name | What changed tonight | Test suite |
|---|---|---|---|
| 42 | Transparent Change Log | Settings changes (time, old, new); changes the app makes itself (automatic calorie/protein targets, with the reason); the plan's change history, with who initiated each change | `e2e_changelog` 28 |
| 28 | Data Confidence Labels | One vocabulary: הוזן ידנית / נמדד / לפי הנתונים שלך / הערכה / המלצה / אין נתון. Each label explains itself on tap, has a ≥40 px tap area, and follows the language (Hebrew/English) | `e2e_provenance` 20 |
| 35 | Low-Data Mode | Setting plus the browser's Save-Data request. No photo is downloaded until tapped (checked on the network) | `e2e_lowdata` 17 |
| 25 | One-Tap Weekly Reset | Preview, selected actions, one confirmation, exact undo. Past workouts are never changed | `e2e_reset` 16 |
| 40 | Preference Presets | 5 presets over existing settings, shown current → new before applying. They never change equipment, the plan or the menu | `e2e_presets` 14 |
| 21 | Smart Reminders | In-app reminders, off by default, with quiet hours. Shown only when the logged data justifies them; "לא היום" hides one for the day | `e2e_reminders` 22 |
| 24 | Offline Travel Pack | The photos for the trip or the next 14 days, with real sizes; downloaded only on tap. Tested with a real network outage | `e2e_offline_pack` 9 |
| 32 | Meal Prep Planner | Batches split so no portion stays in the fridge more than 3 days (food-safety fix) | `stageG_test` +5 |
| 20 | Progress Story | Facts, interpretation (labelled) and "what got in the way", in separate parts | `e2e_story` 7 |
| 12 | Friction Radar | One suggestion at a time from repeated obstacles in the log, with its numbers; nothing changes automatically | `e2e_friction` 13 |

Completed the previous evening (25.10, before the overnight session): SLL-33, SLL-08 (all three parts), SLL-07.

## 2. Bugs found and fixed tonight
1. **Provenance labels too small to tap:** smaller than the 40×40 px minimum on all 7 screen sizes. Found by `e2e_rc1_layout`.
2. **Weekly reset undo:** it rewrote an untouched plans store, creating an empty plans record.
3. **Offline pack size:** the build stripped photo sizes from the media data, so the pack could not show its download size.
4. **Five form fields without a label:** they had only a placeholder.
5. **Double tap on "הוספה":** the second tap landed on the new item's "מחיקה" and deleted it. Destructive controls now ignore taps in their first 400 ms on screen.
6. **Async actions:** they could run twice on a double tap; they now wait until finished (aria-busy).
7. **Meal-prep batches:** a batch could cover meals up to 14 days after cooking.
8. **Test defect, not a product bug:** the `e2e_food_global` check "coordinates not stored" failed once in the final regression (81/82).
   - **Root cause, reproduced deterministically:** the ISO timestamps the app already stores (`region.at`, `profile.createdAt`) read `…:28.6xxZ` when the seconds are 28 and the milliseconds 600–699. The plain `/28\.6|77\.2/` check took them for the latitude. No coordinate is stored.
   - **Fix:** the original check is kept unchanged; it now runs on the stored text with ISO timestamps removed. Controls prove it still catches a stored 28.6, 28.60, 28.6139 or "77.2".
   - **Regression test:** a new group repeats the flow with the clock frozen at 28.650 s.
   - **Correction:** a first fix that night would have missed a stored "28.60". It was replaced before the final run.

In addition, while writing tonight's own tests: 3 weak assertions (always true) were found and replaced before commit.

## 3. Partly done / missing / blocked
The backlog has the details for each idea.
- **Totals:** 16 verified-complete · 15 partial · 6 missing · 6 blocked · 0 broken (43 in total).
- **Blocked, needs the owner:**
  - SLL-02 Minimum Mode: content, durations, streak rule.
  - SLL-04, SLL-09, SLL-23: an AI or translation service (cost and privacy decision).
  - SLL-31: server lists.
  - SLL-36: a native app.
- **Partial because of a pending decision:**
  - SLL-33: the "shopping day" setting.
  - SLL-07 / SLL-13: depend on Minimum Mode.
  - SLL-22 / SLL-30 / SLL-38: need professional content review.

## 4. Tests
- **Full regression** (`bash tools/run_all.sh`):
  - On 4b2bbfa (build a9a81b64f7): 76/76 suites exit 0, artcheck 2/2, 27,277 checks passed, 0 failed.
  - On 2400a81 (build a1c98ddc1a): 81/82 suites. The one failure was the `e2e_food_global` test defect (bug 8).
  - **Final, on 2c9f577 (build a1c98ddc1a): 82/82 suites exit 0, artcheck 2/2, 27,341 checks passed, 0 failed.** The same commit and build were recorded at the start (04:51 UTC) and the end (05:38 UTC) of the run.
  - `e2e_food_global` alone after the fix: 3/3 runs, 32 checks each.
- **New suites tonight (all in `run_all.sh`):**
  - `e2e_changelog`, `e2e_provenance`, `e2e_lowdata`, `e2e_reset`, `e2e_presets`, `e2e_reminders`
  - `e2e_offline_pack` (service worker on), `e2e_a11y_sweep` (25 screens, Hebrew and English), `e2e_double_tap`, `e2e_text_sanity` (27 screens × 3 states + LTR overflow)
  - `e2e_story`, `e2e_friction`
- **What these tests do NOT prove:**
  - They run in Chromium (Playwright) emulating iPhone sizes. That is not Safari, not a real device and not VoiceOver.
  - Accounts and admin are tested only against the local emulator and Postgres.

## 5. Local commits and restore
- **Range:** `49ce1e9..HEAD` on `fix/default-cuisine`. Nothing has been pushed.
- **Backups sent as git bundles:** `sofitgo-local-<hash>.bundle`. Each one was scanned for secrets and restored into a fresh clone with an identical tree. The final bundle is listed in §8.
- **To restore:**
  ```
  git clone --branch fix/default-cuisine https://github.com/shlomihadad1/SoFitGo.git
  cd SoFitGo
  git fetch <bundle> fix/default-cuisine:restored
  ```

## 6. Known issues
- The live site serves build 74bdd9483f (unchanged). Netlify is most likely not linked to the repository.
- English is a developer preview: some spoken labels are still in Hebrew.
- First load is 805,141 B (budget 820,000 B).

## 7. What the owner needs to do before publishing
1. **Approve pushing** `fix/default-cuisine`. No other branch is affected.
2. **Link Netlify** following `docs/NETLIFY_FROM_GITHUB.md`: Stop auto publishing first, then Link repository.
3. **Approve which build goes to netlify-next/live.** This release candidate needs a push first.
4. **Verify in production** following `docs/PRODUCTION_VERIFICATION.md`. Only the owner can do the login and owner checks on an iPhone.
5. **Decide:** shopping day (SLL-33), Minimum Mode (SLL-02), the pre-workout question (SLL-07), and the Android key (is the APK installed anywhere?).

## 8. Final verification
| Item | Result |
|---|---|
| Commit tested | `2c9f577` (code). The commit that follows it adds only this report (docs, no code). |
| Build | `a1c98ddc1a`, first load 805,141 B (budget 820,000) |
| Full regression | `bash tools/run_all.sh`: **82/82 suites exit 0**, artcheck 2/2, **27,341 checks passed, 0 failed** |
| Known open failures | none |
| Remote branches | unchanged: `fix/default-cuisine` 49ce1e9, `main` 50ce8a6, `netlify-live` / `netlify-next` 0c4d08e |
| Live site | unchanged, serves 74bdd9483f (read-only check) |
| Backup | final git bundle, verified by restoring into a fresh clone (see the morning report) |
