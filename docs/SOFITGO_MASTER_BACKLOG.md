# SoFitGo — Master Backlog (single register)

**Updated 25.10.2026** · code `10ee37e` (build `f1248e1201`) on `fix/default-cuisine` · live site: `netlify-live` = build `74bdd9483f`.

Detailed evidence for each item lives in `docs/FEATURE_REGISTRY.md` (FR-…), `docs/BETA_REQUIREMENTS.md` and `docs/SOFITGO_MASTER_REQUIREMENTS.md`. This file is the one list of everything, with its status.

## Sources actually searched (and limits)

| Source | Accessible? | What was used |
|---|---|---|
| This Claude conversation (including its earlier compacted part) | Yes | Owner directives of 24–25.10.2026, delivery reports |
| Other / earlier conversations of the past week | **No** — not accessible from this environment | Nothing. Anything only stated there is unrecovered |
| GitHub `shlomihadad1/SoFitGo`, all 8 branches, all 88 commits (messages and file contents) | Yes | `main`, `fix/default-cuisine`, `netlify-live`, `feat/beta-core`, `fix/cuisine-location-settings`, `m10-dev`, `m10.3`, `qa-agents` |
| Repository docs | Yes | `BACKLOG-SOFITGO.md`, `KNOWN-ISSUES.md`, `docs/INNOVATION-PROPOSALS-M8.md`, `docs/M9-SCOPE.md`, `docs/RELEASE-CANDIDATE-M12.md`, `docs/BUG-STATUS-M10.2.md`, `docs/AI-ARCHITECTURE.md`, `docs/AI-INFRA-AUDIT.md`, `docs/QA-AGENTS.md`, `CHANGELOG.md`, change reports M7–M10, RC1–RC5 |
| Live services | Read-only checks only | sofitgo.com (`sw.js`, `sofitgo-config.js`), anonymous Supabase REST probes; no Netlify or Supabase dashboard access |

## Status legend
| Status | Meaning |
|---|---|
| IMPLEMENTED_AND_VERIFIED | An automated test passes on the current build (browser emulation / local server; **not** a physical device or the live backend unless stated) |
| IMPLEMENTED_NOT_VERIFIED | Code exists; no passing test proves it, or it needs a device / live check |
| PARTIALLY_IMPLEMENTED | Part of the requirement works |
| NOT_IMPLEMENTED | No code |
| BLOCKED | Needs an external service, paid account, native app, licensed content or an owner decision |
| HISTORICAL_IDEA_RECOVERED_NOT_YET_ASSESSED | Found in the history, not yet checked against the code |
| NOT_RECOVERED | Referenced (part of the 43) but no wording exists in any accessible source |

## 1. Sofit Life Loop — SLL-01 … SLL-43

**Source of the names:** the owner's master addendum (25.10.2026), which gives the 43 original names in order.

**Cross-check:** every INN number attested in the repo matches the owner's list at the same position — 01, 02, 03, 07, 08, 09, 17, 18, 22, 24, 25, 30, 33, 41, 43 (15 of 15). The earlier guess "INN-15/16 = wearables" was wrong (15 = Ingredient Substitution Graph, 16 = Budget Mode; wearables = 36).

**Statuses** (the addendum's vocabulary): verified-complete, partial, missing, broken, blocked.

| ID | Name | Status | Evidence in the code | Missing / next | P |
|---|---|---|---|---|---|
| SLL-01 | Sofit Flex | partial | 15/30/60 versions, swaps, low-energy suggestion (`Logic.VERSIONS`, `plans.js`, `builder.js`) | choice by reported energy + place in one step | P1 |
| SLL-02 | Minimum Mode | blocked | ~15-min short version only; "rest is a valid choice" wording on NOW card | reviewed 1/3/5/8-min content + partial-logging rule | P1 |
| SLL-03 | Fridge-to-Meal | verified-complete | `screens_fridge.js`; `e2e_fridge` | — | P1 |
| SLL-04 | Restaurant Copilot | blocked | — | menu understanding / local language needs an AI or translation service (privacy + cost decision) | P2 |
| SLL-05 | Travel Mode | partial | travel sheet, no-equipment swaps, quick meals (`stageG_test`, `e2e_m12_gate`) | flights / festivals / hotel schedules / local food beyond swaps | P2 |
| SLL-06 | Personal Pattern Finder | missing | — | consent model; show sample size + uncertainty | P3 |
| SLL-07 | Plan B | partial | `#/planb` hub; since 2026-10-25 a "מומלץ עכשיו" section picks options from signals already stored on the device, each with a "למה:" reason: a workout saved midway (resume button → same step), missed plan sessions in the last 7 days (→ #/plan), active travel mode, 19:00+ with today's workout not done, shopping items marked "לא נמצא" (→ #/shopping, where SLL-08 offers alternatives). Each option is listed once; with no signal the full list is the fallback; nothing changes until the user acts. Tests: `e2e_planb_feedback` group "SLL-07 Plan B by what changed" (12 checks, fixed clocks 10:00/20:00). Exercise swap and meal swap as before | no reliable signal exists for equipment, space or energy, so those stay manual options; a "short version" depends on Minimum Mode (SLL-02) | P1 |
| SLL-08 | Smart Grocery Loop | verified-complete | v2: categories (food groups), merged quantities, bought / at home / not found, user items with dedupe, copy, clear keeps user items (`e2e_grocery`). v3 per docs/M9-SCOPE.md, all three parts: **(1)** a "not found" item offers 1–3 alternatives from the same SWAP group, never an excluded food, calorie/protein change shown before applying, applied through the existing ingredient swap only to listed, not-eaten meals, undo restores storage exactly; **(2) "usually at home"**: after "יש בבית" on 2 different days the list asks, nothing is set automatically; kept items are folded under "בדרך כלל בבית" (never deleted, not counted), "צריך לקנות הפעם" / "הסרה", "לא" stops the question, clear keeps the setting, undo exact; **(3) carry-over**: a tap stores that day's still-to-buy items; on a later day the unbought items not on the current list are offered once (bought, already-listed, excluded and duplicate items left out), "להוסיף לפריטים שלי" / "לא תודה", undo exact, rendering never writes. Tests: `e2e_grocery` 44 (groups "SLL-08 v3 (1)", "(2)", "(3)") | no prices (none invented, by scope) | P1 |
| SLL-09 | Sofit Memory | blocked | — | consent/edit/delete/opt-out model + an approved AI provider | P2 |
| SLL-10 | Life Score | missing | MoveScore (steps only) | define consistency/strength/endurance/mobility/habit metrics, shown transparently | P3 |
| SLL-11 | Ripple Effect | missing | no-compensation rules exist in the menu engine (no punitive extra exercise) | constructive next-step suggestions UI | P3 |
| SLL-12 | Friction Radar | missing | skip / partial logs exist | detect repeated user-reported barriers; one suggestion at a time | P3 |
| SLL-13 | One-Day Autopilot | partial | NOW card + day plan + menu + water target | one "propose my day" with minimum / balanced / full, editable or rejectable | P2 |
| SLL-14 | Smart Leftovers | partial | meal-prep tags (46 recipes) | leftover reuse suggestions | P2 |
| SLL-15 | Ingredient Substitution Graph | partial | recipe `subs`, allergy-safe swaps in the menu engine | function / flavour / texture graph | P2 |
| SLL-16 | Budget Mode | partial | relative cost 1–3, 87 budget-tagged recipes; no prices (none invented) | budget-bounded plan and list | P2 |
| SLL-17 | Equipment Passport | partial | equipment list in plan setup; travel swaps | profiles per place; needs exercises for more equipment (content) | P2 |
| SLL-18 | Quiet & Small-Space Workouts | partial | `noJump` preference, low-impact filter | explicit quiet / small-space mode | P2 |
| SLL-19 | Workout Builder by Feeling | partial | Workout Builder by goal / time / level / equipment (`e2e_builder`) | readiness / desired-feel inputs | P2 |
| SLL-20 | Progress Story | partial | weekly review `#/review` (`e2e_stageG`) | facts vs interpretation, barriers | P2 |
| SLL-21 | Smart Reminders | partial | `.ics` reminders only; no push (paid / native) | in-app reminder settings with quiet hours | P2 |
| SLL-22 | Recovery Choice | partial | rest-day guidance | new routines need content review | P2 |
| SLL-23 | Local Food Translator | blocked | — | translation service decision | P3 |
| SLL-24 | Offline Travel Pack | partial | offline readiness check in the travel hub; SW shell | pre-cache pack | P2 |
| SLL-25 | One-Tap Weekly Reset | partial | weekly review, grocery clear | one approved reset with a preview | P2 |
| SLL-26 | Adaptive Recipe Scaling | verified-complete | portion limits, portion sheet (`nutrition_v2_test`) | — | P2 |
| SLL-27 | Accessible Coaching Modes | partial | voice cues in workout mode, aria labels, contrast tokens (`e2e_m10_ux`) | captions / audio for coaching text; screen-reader pass | P2 |
| SLL-28 | Data Confidence Labels | partial | "estimate ±%" labels; measured vs typed steps | consistent labels user / verified / estimate / unknown | P2 |
| SLL-29 | User-Controlled Experiments | missing | — | duration + end decision by the user | P3 |
| SLL-30 | No-Shame Comeback | partial | `adapt.js` R-DOWN after gaps | load rules need professional review (DR-01) | P2 |
| SLL-31 | Shared Household List | blocked | — | server lists + sharing permissions | P3 |
| SLL-32 | Meal Prep Planner | partial | meal-prep tags; shopping-list prep section | batch plan with shared ingredients | P2 |
| SLL-33 | Contextual Shortcuts | partial (all documented rules done except one) | chips by state + local clock: log a meal after a logged workout; evening water below target; tomorrow's workout; then the fixed Plan B / fridge / steps / travel in their original order; max 4; "למה הקיצורים האלה?"; no data change without a tap; 23:59/00:00 boundary; fresh install (`Screens.nowShortcuts`; `e2e_now`) | "shopping day" rule needs a shopping-day setting (owner decision); "I have five minutes" waits for Minimum Mode content (SLL-02) | P1 |
| SLL-34 | Explain My Plan | verified-complete | explanation mode (`stageG_test`, `e2e_m12_gate`) | — | P2 |
| SLL-35 | Low-Data Mode | partial | media load on demand; videos not cached | explicit low-data setting | P3 |
| SLL-36 | Consent-Based Wearables | blocked | — | native app (HealthKit / Health Connect) | P3 |
| SLL-37 | Coach Tone Selector | missing | — | tone setting applied to coach texts | P3 |
| SLL-38 | Micro-Learning Cards | missing | — | sourced content (needs review) | P3 |
| SLL-39 | Safe Stop & Escalation | partial | Safe Stop in workout mode (`e2e_m11_run`) | escalation guidance beyond workouts | P1 |
| SLL-40 | Preference Presets | missing | — | workday / hotel / weekend / no-cooking / quiet presets over existing preferences | P2 |
| SLL-41 | Recipe Quality Gate | verified-complete | `tools/recipe_gate.js` 344/344 (completeness, provenance, quantities, timing, nutrition) | — | P1 |
| SLL-42 | Transparent Change Log | partial | plan change history (`e2e_stageB`), CMS audit log | settings and recommendation changes | P2 |
| SLL-43 | Beta Feedback Button | verified-complete | `#/feedback` (`e2e_planb_feedback`), admin triage (`e2e_admin`) | — | P3 |

**Count:**
- 6 verified-complete (SLL-08 added 26.10.2026);
- 23 partial;
- 8 missing;
- 6 blocked;
- 0 broken (none found by the regression).

**Loop:** context → realistic options → choice → action → feedback → consent-based learning → adaptation.
- **Context, options, choice and action** run on the existing NOW card, plan, menu and adapt engine. The new shortcuts reuse them.
- **The consent-based learning group is blocked,** pending the consent model and the AI decision: Memory, Pattern Finder, Friction Radar and Experiments.

**Sofit Life Loop as a whole** (owner addendum): context → decision → action → learning → adaptation, as one experience — the NOW card, plan, adapt engine and weekly review are the existing parts of that loop.

**Recipe requirements (owner addendum, Oct 19):** every home meal links to a recipe in the app, with ingredients and quantities, steps, **prep time separate from cook time**, servings, and nutrition with its source or estimation method; an external link only when the full instructions are external. Status: the 200 v2 recipes have all of these fields in-app (`prep`, `cook`, `servings: 1`, values from the food table with provenance; `nutrition_v2_test`, `content_test`); no external recipe links are used. **"22 minutes"** in the history is the workout-duration defect D4 (a workout shown as 22 min that did not match its content), fixed by the duration engine (`e2e_stageA`) — it is not a recipe-time requirement.

**Ideas that had no INN number before** (NOW card, Data Confidence Labels, Explain My Plan, Adaptive Recipe Scaling, Smart Leftovers / Meal Prep, Budget Mode, Low-Data Mode, Coach Tone Selector, Micro-Learning Cards, Preference Presets, Safe Stop, Transparent Change Log, Restaurant Copilot / Local Food Translator, Shared Household List, Life Score, Ripple Effect, One-Day Autopilot, Pattern Finder / Friction Radar, widgets / voice): **now mapped to their SLL IDs above** using the owner's list. The SofitGo NOW card itself is the entry point of the loop: IMPLEMENTED_AND_VERIFIED (`e2e_now`).

## 2. Product requirements

**Columns:** status · evidence · P · privacy/cost · next step.

**Recurring cost** is ₪0 for every row unless the row says otherwise. The agreed budget is ₪0–75 per month.

| ID | Requirement (source) | Status | Evidence / files | P | Privacy / cost | Next step |
|---|---|---|---|---|---|---|
| BL-ADM-01 | "ניהול מערכת" button for owner/admin (owner, 25.10) | IMPLEMENTED_AND_VERIFIED (local); not yet live | `Account.adminAccess`, `Screens.adminEntry`; `e2e_admin` 70 | P0 | Server enforces; the button is cosmetic | Publish after approval (`netlify-next` → `netlify-live`) |
| BL-ADM-02 | CMS: recipes, exercises, texts, layout, design, settings, roles, audit, history/rollback (owner directives) | IMPLEMENTED_AND_VERIFIED (local); migrations applied live by owner | `admin.js`, `admin_app.js`; `rls_cms_test` 99, `e2e_admin` 70 | P0 | RLS + checked functions | Live smoke test after publish |
| BL-ADM-03 | Feedback / issue triage | IMPLEMENTED_AND_VERIFIED (local) | migration 0200; `e2e_admin` | P1 | Admin only; no reporter e-mail | — |
| BL-ADM-04 | Accounts overview | IMPLEMENTED_AND_VERIFIED (local), aggregate only | migration 0300 | P1 | No per-user data | Per-user support tools need a privacy decision |
| BL-ADM-05 | Training-plan templates, video/media upload, subscription config in admin | NOT_IMPLEMENTED / BLOCKED | media: Storage bucket; subscriptions: no provider | P2 | Storage may cost | Owner decisions |
| BL-ACC-01 | Registration, login, recovery, sign-out, session (owner) | IMPLEMENTED_AND_VERIFIED (local emulator) | `e2e_account` 113 | P0 | Supabase Auth (free tier) | Live check on the device |
| BL-ACC-02 | Cloud sync with conflict choice; no silent overwrite | IMPLEMENTED_AND_VERIFIED (local) | `e2e_m11_sync` | P0 | Own rows only (RLS) | Live two-device check |
| BL-ACC-03 | Onboarding / profile setup | IMPLEMENTED_AND_VERIFIED | `e2e_stageB` | P0 | — | — |
| BL-WO-01 | 15/30/60-minute workouts, levels, no-equipment home workouts | IMPLEMENTED_AND_VERIFIED | `stageA_test`, `stageB_test` | P0 | — | — |
| BL-WO-02 | Workout session: timers, rest, pause, interruption, completion, no duplicates | IMPLEMENTED_AND_VERIFIED (emulation) | `run_state_test`, `e2e_run_state`, `e2e_m11_run` | P0 | — | Physical-device test (lock, background) |
| BL-WO-03 | Workout Builder; smart exercise substitution | IMPLEMENTED_AND_VERIFIED | `builder_test`, `e2e_builder` | P1 | — | — |
| BL-WO-04 | Adaptive progression from history | IMPLEMENTED_AND_VERIFIED (rules) | `adapt.js`; `stageF_test` | P1 | — | — |
| BL-WO-05 | Equipment-based plans (dumbbells, bands, gym) | BLOCKED | no equipment exercises in the library | P2 | — | Reviewed exercise content |
| BL-VID-01 | Video workout library, multilingual, captions, AI dubbing, licensing, hosting cost | BLOCKED / NOT_IMPLEMENTED | 0/57 demo videos; tutorials of the app UI only (12, per build) | P2 | **Cost:** licensed video + hosting + dubbing are paid; not approved | Cost comparison before any service |
| BL-NUT-01 | Recipes, ingredients, macros, meal plans, preferences, exclusions, swaps, journal | IMPLEMENTED_AND_VERIFIED | `nutrition_v2_test`, `e2e_meal_journal`, `e2e_menu_structure` | P0 | — | — |
| BL-NUT-02 | Shopping list, fridge | IMPLEMENTED_AND_VERIFIED | `e2e_grocery`, `e2e_fridge` | P1 | — | — |
| BL-NUT-03 | Food photo / barcode | BLOCKED | needs a vision model or barcode database | P3 | Paid AI or DB; privacy | Owner decision |
| BL-TRK-01 | Water in litres (+0.25/+0.5/+0.75/−0.25), target, never negative | IMPLEMENTED_AND_VERIFIED | `core.js` (`Math.max(0, …)`), `screens_home.js`; `e2e_activity`, `e2e_m10_ux` | P1 | — | — |
| BL-TRK-02 | Steps manual/CSV, daily/weekly/monthly; no fake defaults | IMPLEMENTED_AND_VERIFIED | `activity_test`, `e2e_activity` | P1 | — | — |
| BL-TRK-03 | Weight, measures, weekly review, records, streaks | IMPLEMENTED_AND_VERIFIED (records PARTIAL) | `e2e_stageD`, `e2e_stageG` | P1 | — | Show the basis of each record |
| BL-INT-01 | Apple Health / Health Connect / watches | BLOCKED | a PWA cannot read them; `native/` scaffolding only | P3 | Native app | Native build decision |
| BL-INT-02 | Google / Apple Calendar | PARTIALLY_IMPLEMENTED: one-way `.ics` export | `sync_tools.js`; `e2e_m11_sync` | P2 | Two-way sync needs OAuth (Google, free) | Decide on Google OAuth |
| BL-TRV-01 | Travel-aware workouts and food; Plan My Trip kept separate | PARTIALLY_IMPLEMENTED (Travel Mode verified; trip planner NOT_IMPLEMENTED, separate product) | `stageG_test` | P2 | Location only on tap | — |
| BL-AI-01 | Sofit coach | PARTIALLY_IMPLEMENTED: deterministic rules, labelled "לא AI" | `coach_ask.js`; `e2e_m11_coach` 79 | P1 | **No AI provider; cost and privacy decision pending** (`docs/AI-INFRA-AUDIT.md`) | Owner approves a provider and budget |
| BL-BIZ-01 | Free / Premium, entitlements, payments | NOT_IMPLEMENTED | no code; admin says so | P2 | Payment provider fees | Owner decision on plans and provider |
| BL-I18N-01 | Multiple languages | PARTIALLY_IMPLEMENTED (Hebrew full; English shell only) | `i18n.js`; `e2e_i18n` | P2 | — | Key migration |
| BL-UX-01 | iPhone Safari header/layout (P0-E), no horizontal overflow | IMPLEMENTED_NOT_VERIFIED on a device (emulation passes) | `e2e_rc1_layout`, `e2e_shell`; `SAFARI-DEVICE-CHECKLIST.md` | P0 | — | Owner checks on the iPhone (`?debug=layout`) |
| BL-OFF-01 | PWA offline shell, service worker, updates | IMPLEMENTED_AND_VERIFIED (Chromium); Safari offline unverified | `e2e_sw_shell` | P1 | — | Device test T10 |
| BL-PRV-01 | Privacy Center, CSV export, account deletion | IMPLEMENTED_AND_VERIFIED | `e2e_builder`, `e2e_account` | P1 | Local generation only | — |
| BL-QA-01 | 7-responsibility QA, Playwright, GitHub Actions daily 08:00 IST, Hebrew reports kept 14 days, PR/manual runs | IMPLEMENTED_NOT_VERIFIED in CI this session (workflow file present; not run here) | `tools/qa/run_qa.js` (7 roles), `.github/workflows/qa-daily.yml` | P1 | GitHub Actions free minutes | Owner checks the Actions tab |
| BL-QA-02 | Auto-fix agents | NOT_IMPLEMENTED by design | never publish unreviewed fixes | P3 | — | — |
| BL-REL-01 | Release evidence, rollback, signing-key backup | IMPLEMENTED; key backup BLOCKED on the owner (age public key) | `docs/release/`, `docs/ANDROID_SIGNING_KEY.md` | P1 | — | Owner sends the age public key |

## 3. Bugs and regressions (history + this week)

| ID | Bug | Status | Regression test |
|---|---|---|---|
| D1 / P0-E | Safari iPhone header / buttons disappear | Fixed structurally; **device-unverified** | `e2e_rc1_layout`, `e2e_shell` |
| D2–D13 | Food log paths, goal wording, duration, mobile nav, weekly views, Netlify badge (owner setting), auth errors, persistence, error recovery, oversized dish, default cuisine, meal labels | Fixed (D7: owner setting) | see master §2 |
| BUG-25-01 | Background > 15 min counted as workout time (0:11 → 120:13) | Fixed | `e2e_run_state` |
| BUG-25-02 | 2 h closed app counted as workout time | Fixed | `run_state_test`, `e2e_run_state` |
| BUG-25-03 | Double tap on "activate plan" corrupted plan history | Fixed | `stageB_test`, `e2e_stageB` |
| BUG-25-04 | Builder workout edited / deleted mid-session (steps changed / crash) | Fixed | `e2e_builder` |
| BUG-25-05 | Rollback 0100 in the wrong order left orphan functions | Fixed (refuses) | `migration_audit_test` |
| BUG-25-06 | Admin role check: an error retried on every render (request→render loop, stuck "loading") | Fixed | `e2e_admin` |
| ENV-25-01 | Tutorials 0/12 | **Environment**, not product: the local server on 8096 had stopped (`ERR_CONNECTION_REFUSED`). After a restart: 12/12, `rc1_test` 87/87 | `rc1_test` |

## 4. Totals (this register)
- **Sofit Life Loop:** all 43 named (owner's list). 6 verified-complete, 23 partial, 8 missing, 6 blocked, 0 broken.
- **Product requirements:** 32 rows. See §2.
- **Bugs:** §3. This week's 6 are fixed and covered by tests.
