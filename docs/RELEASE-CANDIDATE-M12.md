# SoFitGo — Release Candidate M12 (beta)

**Branch:** `feat/beta-core` (local, not pushed). The commit hash is in `git log` — the release candidate is the commit that adds this file.
**Base:** `4e47012` = `fix/cuisine-location-settings` (PR #2), which builds on `qa-agents` (PR #1).

## What is in this RC (on top of PR #1 + PR #2)
| Unit | What works | Main files |
|---|---|---|
| M11.1 Workout | Manual or automatic continuous mode chosen before the workout: countdown, work, rest, next set/exercise; rest between sets / between exercises; voice cues (where the browser supports them); per-set feedback during the rest; double-advance guard; background/locked-screen guard (no retroactive completion); Safe Stop; summary + history (mode, planned vs actual rest) | `src/js/run.js`, `src/js/run_setup.js` |
| M11.2 Sofit | Local, data-grounded coach: quick actions, real actions (open workout in the runner, meal swap, water, exercise explanations/alternatives, travel), "what Sofit knows", chat-only context labelled, provider interface for a future server-side AI | `src/js/coach_ask.js`, `src/js/screens_m8.js` |
| M11.3 Nutrition | One swap path (nutrition screen + Sofit): goal-aware sorting, restrictions/dislikes/cuisine/prep time, preview with day impact (planned vs eaten), optional protein rebalance, failed writes reported | `src/js/meal_options.js` |
| M11.4 Activity | Steps import from a CSV file (preview, labelled source, idempotent); personal-plan calendar export (.ics, stable UIDs) | `src/js/sync_tools.js` |
| M12 Gate | Plan Integrity Gate (one independent validator: workouts, plans before activation, meals, menu, goals) + Conflict Resolver UI (what/why/options, one focused question for goal conflicts) + explanation mode (short/detail, tags: based on your settings / estimate / recommendation) + extended Travel Mode (dates, minutes, equipment; today original/updated/done; tired/late/unwell through existing plan operations; destination food search) | `src/js/gate.js`, `src/js/gate_ui.js`, `src/js/screens_m8.js`, `src/js/screens_plan.js` |

All new modules load on demand (`extra.js`); first load stays under the 712 KB budget (measured by `e2e_stageA`).

## Build and run
```
npm install                      # esbuild + playwright (test tooling only)
node tools/build.js              # → dist/pwa (site), dist/artifact
node tools/tutorials_build.js    # only after a code change (needs a server on :8096); then build again
python3 -m http.server 8096 -d dist/pwa   # local run
node tools/qa/run_qa.js --mode full       # consolidated QA (needs PostgreSQL 16: sh tools/pg_local.sh)
```
Live Supabase config: `sofitgo-config.js` next to `index.html` (URL + publishable key only — never a secret key; `build_check` refuses `sb_secret_`).

## Merge and deploy plan (NOT done — needs owner approval)
1. Merge PR #1 (`qa-agents` → `main`).
2. In PR #2 change base to `main`, merge.
3. Push `feat/beta-core`, open PR → `main`; CI runs quick QA on the PR; run the full QA via *Actions → QA daily → mode full*; merge when green.
4. Deploy: `node tools/build.js`, upload `dist/pwa` (+ `sofitgo-config.js`) per `DEPLOY.md`; then `node tools/deploy_check.js https://sofitgo.com/ live`.
5. Manual device check on a real iPhone (Safari) and an Android phone: `SAFARI-DEVICE-CHECKLIST.md`.

**Rollback:** keep the currently deployed folder/zip before uploading; to roll back re-upload it (Netlify: *Deploys → previous deploy → Publish deploy*). Code: `git revert` the merge commit. Local data is backward compatible (new fields are optional; old sessions resume in manual mode).

## Real limitations (not fixable from here)
- Not tested on a real iPhone/Safari or any Android device (Chromium + Playwright WebKit engine only).
- Sofit is a local rule-based coach, not an AI model; an AI provider needs a server-side proxy, a key and a cost decision.
- Steps from Apple Health / Health Connect need the native app build on devices (code exists, unverified); the web app uses manual entry or file import.
- Calendar: one-way .ics export; reading Google/Apple calendars needs OAuth/native.
- No restaurant/menu data provider: nearby food opens an external map search (on click). Real restaurant data would need a provider (paid for menus/prices).
- No push notifications (needs a push server); reminders = calendar file alarms.
- Premium/billing: none in the app; no entitlements are granted client-side.
- Email delivery/confirmation links not tested (no mailbox; built-in SMTP limited) — SMTP setup pending.
- Two live test users await the owner's SQL approval (confirmation).

## Owner actions required
Merge PR #1/#2, push + PR for `feat/beta-core`, deploy, SMTP setup, test-user SQL approval, device checks, and any paid service decision (AI, restaurant data).

## Consolidated regression (run once, on `956be4b`)
`node tools/qa/run_qa.js --mode full` (local, Chromium + Playwright WebKit engine, PostgreSQL 16 local emulator): **57 suites PASS (15,556 checks), 0 FAIL, 2 BLOCKED** (live Supabase checks — not authorised; auto-fix — no approved AI), **4 NOT TESTED** (real Safari/devices, real email delivery, AI coach model, subscriptions). Local servers were up for the whole run.
