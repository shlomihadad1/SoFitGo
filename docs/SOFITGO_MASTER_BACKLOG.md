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

**What the history contains:**
- `docs/SOFITGO_MASTER_REQUIREMENTS.md` §12: "The 43-idea master list (13 original + 30 added) is not stored in the repository."
- The INN numbers below are the only ones attested anywhere in the 88 commits.
- SLL-nn = INN-nn.

| ID | Name (as recorded) | Source | Status | Files | P | Next step |
|---|---|---|---|---|---|---|
| SLL-01 | Sofit Flex (15/30/60, swaps, low energy) | INN-01, master §12, INNOVATION-PROPOSALS-M8 #5 | PARTIALLY_IMPLEMENTED | `Logic.VERSIONS`, `plans.js`, `builder.js` | P1 | Pick by equipment, place and day schedule (needs reviewed load rules) |
| SLL-02 | Minimum Mode (1/3/5/8 min) | INN-02 | BLOCKED | — | P1 | Reviewed micro-workout content + a rule for logging partial workouts |
| SLL-03 | Fridge-to-Meal | INN-03 | IMPLEMENTED_AND_VERIFIED | `screens_fridge.js`; `e2e_fridge` | P1 | — |
| SLL-04 | — | — | NOT_RECOVERED | — | — | Owner to supply the wording |
| SLL-05 | — | — | NOT_RECOVERED | — | — | " |
| SLL-06 | — | — | NOT_RECOVERED | — | — | " |
| SLL-07 | Plan B hub ("I don't have X") | INN-07 | PARTIALLY_IMPLEMENTED | `screens_beta.js`; `e2e_planb_feedback` | P1 | More "I don't have X" paths |
| SLL-08 | Smart Grocery Loop (v2 done, v3 = swaps for "not found") | INN-08 | PARTIALLY_IMPLEMENTED | `screens_shopping.js`; `e2e_grocery` | P1 | v3 swaps from the `SWAP` table |
| SLL-09 | User-Controlled Sofit Memory | INN-09 | BLOCKED | — | P2 | Consent/delete model + approved AI provider |
| SLL-10 … SLL-14 | — | — | NOT_RECOVERED (5) | — | — | Owner to supply |
| SLL-15 | Wearables? (recorded only as "INN-15/16?") | master §12 | BLOCKED; name uncertain | — | P3 | Confirm the name; native app needed |
| SLL-16 | Wearables? (same uncertain record) | master §12 | BLOCKED; name uncertain | — | P3 | Same as SLL-15 |
| SLL-17 | Equipment Passport (with SLL-18) | INN-17/18 | PARTIALLY_IMPLEMENTED | plan setup equipment list, travel swaps | P2 | Plans change by place (TD-03); needs equipment exercises |
| SLL-18 | Quiet & Small-Space (recorded together with SLL-17) | INN-17/18 | PARTIALLY_IMPLEMENTED | `noJump` preference | P2 | Same dependency |
| SLL-19 … SLL-21 | — | — | NOT_RECOVERED (3) | — | — | Owner to supply |
| SLL-22 | Recovery Choice (rest / walk / mobility) | INN-22 | PARTIALLY_IMPLEMENTED | rest-day guidance | P2 | New routines need content review |
| SLL-23 | — | — | NOT_RECOVERED | — | — | Owner to supply |
| SLL-24 | Offline Travel Pack | INN-24 | PARTIALLY_IMPLEMENTED | travel hub readiness check | P2 | Pre-cache pack |
| SLL-25 | One-Tap Weekly Reset | INN-25 | PARTIALLY_IMPLEMENTED | `#/review` | P2 | One reset action with a preview |
| SLL-26 … SLL-29 | — | — | NOT_RECOVERED (4) | — | — | Owner to supply |
| SLL-30 | No-Shame Comeback | INN-30 | PARTIALLY_IMPLEMENTED; rules BLOCKED | `adapt.js` (R-DOWN after gaps) | P2 | Professional review of return-to-load rules (DR-01) |
| SLL-31, SLL-32 | — | — | NOT_RECOVERED (2) | — | — | Owner to supply |
| SLL-33 | Contextual Shortcuts v2 | INN-33 | PARTIALLY_IMPLEMENTED | NOW card chips (`screens_home.js`) | P1 | Choose shortcuts by state and time |
| SLL-34 … SLL-40 | — | — | NOT_RECOVERED (7) | — | — | Owner to supply |
| SLL-41 | Recipe Quality Gate | INN-41 | IMPLEMENTED_AND_VERIFIED | `tools/recipe_gate.js` (344/344) | P1 | — |
| SLL-42 | — | — | NOT_RECOVERED | — | — | Owner to supply |
| SLL-43 | Beta Feedback Button | INN-43 | IMPLEMENTED_AND_VERIFIED | `screens_beta.js`; `e2e_planb_feedback`; admin triage (`e2e_admin`) | P3 | — |

**Count:**
- 15 IDs recovered with a name.
- 2 IDs referenced but with an uncertain name (SLL-15, SLL-16).
- **26 NOT_RECOVERED.**

Earlier today I reported "16 attested, 27 not recovered". The exact contexts show that `INN-17/18` also attests 18, so the correct split is 17 referenced and 26 not recovered.

**Ideas from the same backlog with no INN number** (recovered, no SLL slot is assigned because no number exists for them):

| Idea | Status | Evidence |
|---|---|---|
| SofitGo NOW card | IMPLEMENTED_AND_VERIFIED (1st slice) | `e2e_now` |
| Data Confidence Labels | PARTIALLY_IMPLEMENTED | estimate labels |
| Explain My Plan | IMPLEMENTED_AND_VERIFIED | `stageG_test`, `e2e_m12_gate` |
| Adaptive Recipe Scaling | IMPLEMENTED_AND_VERIFIED | portion limits; `nutrition_v2_test` |
| Smart Leftovers / Meal Prep Planner | PARTIALLY_IMPLEMENTED | meal-prep tags |
| Budget Mode | PARTIALLY_IMPLEMENTED | cost rating 1–3, no prices |
| Travel Mode | IMPLEMENTED_AND_VERIFIED | `stageG_test`, `e2e_m12_gate` |
| Personal Pattern Finder / Friction Radar | NOT_IMPLEMENTED | needs the consent model |
| Restaurant Copilot / Local Food Translator | BLOCKED | AI service |
| Shared Household List | BLOCKED | server lists + sharing |
| One-Day Autopilot, Life Score, Ripple Effect | NOT_IMPLEMENTED | proposed only |
| Low-Data Mode | PARTIALLY_IMPLEMENTED | media on demand |
| Coach Tone Selector, Micro-Learning Cards, Preference Presets | NOT_IMPLEMENTED | proposed only |
| Safe Stop & Escalation | PARTIALLY_IMPLEMENTED | stop guidance in workouts |
| Transparent Change Log | PARTIALLY_IMPLEMENTED | plan change log |
| Widgets, voice, animation | BLOCKED | native / OS features |

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
- **Sofit Life Loop:**
  - 43 IDs.
  - 15 recovered with a name; 2 referenced with an uncertain name; **26 NOT_RECOVERED**.
  - Of the 17 referenced: 3 IMPLEMENTED_AND_VERIFIED, 10 PARTIALLY_IMPLEMENTED (SLL-30's rules are also blocked), 4 BLOCKED (including the two uncertain ones).
- **Other recovered ideas** (no number): 16 rows.
- **Product requirements:** 32 rows, counted by each row's first status:
  - 18 IMPLEMENTED_AND_VERIFIED (several local or emulation only);
  - 4 PARTIALLY_IMPLEMENTED;
  - 3 NOT_IMPLEMENTED;
  - 4 BLOCKED;
  - 2 IMPLEMENTED_NOT_VERIFIED;
  - 1 IMPLEMENTED with a blocked part (signing-key backup).
- **Deduplicated:** 3 items. INN-17/18 is one record covering two IDs; Travel Mode appeared in both §12 and §9; the feedback button appeared in §12 and §12.1.
