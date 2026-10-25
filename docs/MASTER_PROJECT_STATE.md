# SoFitGo — Master Project State (OMNISYSTEM Phases 0–2)

**Date:** 25.10.2026. **Repo:** `shlomihadad1/SoFitGo` (private). **Branch:** `fix/default-cuisine`. The exact commit and build of the delivered version are in `docs/SOFITGO_MASTER_REQUIREMENTS.md` §16.

This document is the short operational map of the project:
- The full requirement matrix stays in `docs/SOFITGO_MASTER_REQUIREMENTS.md`.
- The feature index is `docs/FEATURE_REGISTRY.md`.

Historical reports in the repo root (`TEST-RESULTS-*`, `STAGE-*`, `RC1-REPORT.md`, …) are **leads, not proof**. Anything marked verified below was re-run on this branch.

## Phase 0: workspace protection

| Item | Finding |
|---|---|
| Working tree | Clean before every commit in this session. No foreign uncommitted work exists. |
| Branches (remote) | `main`, `fix/default-cuisine` (this work), `feat/beta-core` (PR #3, merged/closed), `fix/cuisine-location-settings` (PR #2), `qa-agents` (PR #1: daily QA workflow), `m10-dev`, `m10.3` |
| Destructive operations | None. No force-push, no history rewrite, no merge to `main`, no deploy. |
| Production | sofitgo.com serves an older build (e54c7d8bc3; read-only check earlier). Live Supabase was not touched. The CMS migration is **not applied**. |
| Secrets | Only public values reach the client: Supabase URL and **publishable** key (`tools/build.js` refuses secret or service keys). `build_check` scans bundles for secrets. No AI keys exist. |

## Architecture: what exists and where

| Layer | Implementation | Notes |
|---|---|---|
| App | Vanilla-JS PWA, Hebrew RTL, no runtime dependencies (`package.json` has dev tools only) | `src/js/*.js`, `src/css/styles.css`, `src/data/*.js` |
| Build | `tools/build.js` → `dist/pwa` | First-load bundle (budget **820,000 B**, `e2e_stageA`). On-demand chunks: `help.js`, `extra.js`, `account.js`, `cms.js`, `admin.js`, `cms-catalog.js`. Service worker `sw.js` keyed by build id. Single-file artifact `dist/artifact/fit30.html`. |
| Routing | Hash routes in `main.js` (`screenFor`) | home, calendar, workouts, day, ex, nutrition, recipes, recipe, nearby, targets, progress, settings, install, programs, program, media, profile, setup, plan, pday, explain, review, shopping, records, planb, feedback, fridge, activity, coach, travel, help, account, admin, legal |
| State / persistence | `store.js`: localStorage keys `fit30.profile`, `workouts`, `session`, `nutrition`, `tracking`, `meta`, `plans`, `avatar` (+ `fit30.cms` cache) | Failed saves roll back and show an error (`e2e_savefail`). Backup/restore to JSON (`App.exportBackup` / `importBackup`). |
| Accounts / sync | Supabase Auth + `profiles`, `user_state` (RLS), migration `20261020000100` | `account.js`. Sync is opt-in. Tested on the local emulator (`e2e_account`, `e2e_m11_sync`, `rls_test`). |
| Authorization | PostgreSQL RLS + SECURITY DEFINER functions | `cms_*` roles: owner/admin/editor/reviewer. No self-grant. |
| Admin / CMS | `#/admin`: `admin.js` + `admin_app.js`; loader `cms_content.js` | Recipes, exercises, texts, layout, design tokens, settings, roles, audit, guides, media inventory (upload blocked). See master doc §10/§10A. |
| Workout engine | `logic.js`, `planner.js`, `plans.js` (first load); `run.js` + `run_state.js` (workout mode with a state machine, in extra.js behind a first-load stub; see docs/WORKOUT_SESSION_STATE_MACHINE.md), `adapt.js` (rule-based adaptation), `gate.js` (Plan Integrity Gate) | 15/30/60-min versions, duration breakdown (`Logic.durationBreakdown`) |
| Nutrition | `nutrition.js` (food table per 100 g, `src`/`chk` provenance), `recipes_med.js` (200 v2), `recipes_intl.js`, `mealplanner.js` (deterministic, seeded), `core.js` (journal, targets) | Values only from ingredients × food table. 15 new foods verified against USDA SR Legacy (via mirrors). |
| Hydration / activity | `core.js` water (quick-add in litres, `qa-agents`), `activity.js`/`activity_more.js` steps (manual / CSV; no Health integration) | |
| Workout Builder | `builder.js` + `screens_builder.js` (#/builder, extra chunk); saved workouts in Store `workouts.custom`, runs in `workouts.customLog` (snapshot) | Starts in the existing runner; checked by the Gate |
| Privacy Center / export | `screens_privacy.js` (#/privacy), `export_csv.js` (CSV per category, local only) + JSON backup | Statements derived from code and account state |
| Coach "Sofit" | `coach_ask.js` (local topic rules), `insights.js`, `screens_m8.js` | **No AI model.** Labelled "לא AI". |
| AI | **None** | Inventory and zero-cost options in `docs/AI-INFRA-AUDIT.md` (awaiting the owner's decision). |
| Subscriptions / payments | **None** (`gate.js` is the Plan Integrity Gate, not a paywall) | No entitlement model. |
| Localization | `i18n.js`: 11 keys he/en (developer preview `?lang=en`); CMS text overrides per language | Not a full i18n system. |
| Media | Generated exercise covers, per-build tutorial recordings; `media_build.js` enforces source and licence | 0/57 demo videos; Storage upload blocked. |
| Native | `native/` Capacitor scaffolding (iOS/Android additions, HealthKit notes) | **Not built or tested.** |
| Tests / CI | `tools/run_all.sh` (≈64 suites), `tools/qa/run_qa.js` (7 QA roles, Hebrew report), `.github/workflows/qa-daily.yml` | Browser tests are Playwright Chromium/WebKit **emulation**; no physical devices. |

## Historical agent proposals: recovered status

The original specifications were not found as separate documents. The names were searched across the whole repo and git history. A "reconstruction" means the behaviour exists but the original spec text is not available.

| Proposal | Found | Where / status |
|---|---|---|
| Safe Stop Path | yes | `run.js` (stop / pause / safety message), `e2e_m11_run`; `docs/RELEASE-CANDIDATE-M12.md` |
| Plan Integrity Gate | yes | `gate.js` + `gate_ui.js`, used before activation, start, swaps and by Sofit; `e2e_m12_gate` |
| Constraint Conflict Resolver | yes | `gate_ui.js` (conflict sheet with options); `e2e_m12_gate` |
| Workout Duration Reality Engine | reconstruction | `Logic.durationBreakdown` / `estimateMinutes` (warm-up, sets, rest, transitions); `ramp_test`, `e2e_stageA` (D4) |
| Workout Session State Machine / Session Continuity / Session Recovery Contract | implemented 25.10.2026 | `run.js` saves after every action, resumes on reopen, parks; duplicate completion guarded by the log. **No formal state table or expiry rule is documented** (FR-W-07). |
| Consent-Based Local Food Discovery | reconstruction | `screens_food_near.js`: location only on tap, opens external maps; never changes cuisine (`e2e_food_global`) |
| Locale & Unit Integrity Linter | partial | `location_scan.js` (location/consent scan), `e2e_i18n`; no unit/plural linter |
| Nutrition Calculation Trace | partial | Provenance on foods (`src`, `chk`), calculation from ingredients. No per-calculation trace record (FR-N-05). |
| Data Freshness & Provenance Watch | not found | Only static `src` fields; no freshness dashboard (FR-N-06) |
| Release Evidence Bundle | yes | §16 of the master doc + ZIP checks (build id, `unzip -t`); no single bundle file |
| Constraint Replay Harness | not found | Closest: `stageH1_test` / `nutrition_v2_test` multi-profile replays |
| Adaptive Instruction Modes | not found | Exercise pages have one instruction depth |

## Historical issues: re-checked

| Issue | Current state |
|---|---|
| Registration stuck after an error | Recovery paths covered by `e2e_account` (local emulator). Live mail was not re-tested (forbidden: no SMTP checks). |
| Meal Journal timeouts | Root cause found: the test assumed a snack slot (master doc §10A.4). Isolation evidence is in §16. |
| Intermittent parallel E2E failures | Same root cause (plan-id-dependent menus), not load. |
| Safari header | Structural fix plus emulated tests; **device test still required** (D1). |
| Hydration controls | Litre quick-add (`qa-agents`), `e2e_activity` / water tests |
| CMS initialization | Lazy `cms.js`; boot waits for it when cached (no flash); `e2e_app_control` |
| Admin permissions | Server-side (`rls_cms_test`) |
| Food preference persistence | `e2e_food_global`, `e2e_m104_fixes` |
| First-load performance | 787,161 B measured (budget 820,000 B) after the runner moved on demand |
| Media storage | Blocked (no bucket); `docs/CMS-STORAGE-SETUP.md` |
| Build-version mismatches | `rc1_test` (tutorials recorded from this build), SW build id check in the ZIP verification |

## What must not be changed without approval

- Live Supabase schema and data, auth settings, SMTP, DNS.
- Netlify deploys, `main`.
- Billing.
- The target formula, the portion limits and the food table values (safety; code review only).
- The secret-key refusal in `tools/build.js`.

## Uncertain / not verifiable here

- Any physical device behaviour.
- The live Supabase plan, quotas and spend cap.
- The Netlify plan and credits.
- Whether hosted Edge Functions are enabled.
- FDC values checked directly on fdc.nal.usda.gov (only mirrors were reachable).
