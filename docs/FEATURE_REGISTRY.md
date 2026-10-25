# SoFitGo — Feature Registry (single operational index)

**Date:** 25.10.2026.

**States:**

| State | Meaning |
|---|---|
| VERIFIED_PASS | Automated test passed on the delivered build (emulation only) |
| IMPLEMENTED_UNTESTED | Implemented, but no automated test covers it |
| PARTIAL | Only part of the feature exists |
| FAIL | Implemented and its test fails |
| BLOCKED | Waiting on an external service, native app or owner approval |
| NOT_FOUND | No implementation exists |
| NEEDS_MANUAL_DEVICE_TEST | Must be checked on a physical device |
| DEFERRED | Postponed on purpose |

A feature's UI alone never makes it VERIFIED_PASS. Test evidence is the suite named in the row, with results in `docs/SOFITGO_MASTER_REQUIREMENTS.md` §16 for the delivered commit.

**Complexity:** S (small), M (medium), L (large).

**Sources:**

| Code | Source |
|---|---|
| D | Owner directives in this project |
| H | Historical repo docs |
| A | Agent proposals |
| O | OMNISYSTEM directive |

## Core (P0/P1)

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-C-01 | Local persistence + failed-save rollback | Data never silently lost | VERIFIED_PASS | `store.js`, `main.js` (`fit30:savefail`) | `e2e_savefail`, `e2e_stageB` | localStorage | Storage full → visible error | Failed write shows an error; data unchanged | S | — |
| FR-C-02 | Backup / restore (JSON) | Device change, recovery | VERIFIED_PASS | `App.exportBackup` / `importBackup`, `Store.validateBackup` | `e2e_stageB` | — | Photos excluded (stated) | Restore equals backup | S | Cloud backup = account sync |
| FR-C-03 | Accounts, sign-up / login / recovery | Multi-device | VERIFIED_PASS (local emulator) / BLOCKED (live re-test forbidden) | `account.js`, `screens_account.js`, migration `20261020000100` | `e2e_account`, `rls_test` | Supabase Auth | RLS per user | Every error has a way out | M | Device test |
| FR-C-04 | Sync of profile and state | Same data everywhere | VERIFIED_PASS (local) | `account.js` sync, `sync_tools.js` | `e2e_m11_sync` | `user_state` | Conflict choice shown | No silent overwrite | M | — |
| FR-C-05 | Safari / iOS layout (header, bars) | Usable on iPhone | NEEDS_MANUAL_DEVICE_TEST | `styles.css` (M7 structural fix) | `e2e_rc1_layout`, `e2e_shell` (emulated) | — | — | No hidden headings on a real iPhone | S | Owner device check (`SAFARI-DEVICE-CHECKLIST.md`) |
| FR-C-06 | First-load budget | Fast start | VERIFIED_PASS | `tools/build.js` chunks | `e2e_stageA` (< 820,000 B) | — | — | Budget unchanged | S | — |
| FR-C-07 | Offline app shell | Works without network | VERIFIED_PASS | `sw.js` | `e2e_sw_shell`, `e2e_meal_journal` (offline reload) | — | — | Reload offline keeps data | S | — |

## Workouts

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-W-01 | Exercise library (57, full instructions) | Correct technique | VERIFIED_PASS | `src/data/exercises.js`, CMS overrides | `e2e_content`, `stageA_test` | — | — | Every exercise has start, steps, breathing, mistakes | S | Demo videos (BLOCKED, no licensed media) |
| FR-W-02 | Plans by goal / level / days; 15/30/60 min | Personal training | VERIFIED_PASS | `planner.js`, `plans.js`, `Logic.VERSIONS` | `stageB_test`, `e2e_stageB`, `e2e_stageA` | profile | — | Plan respects days and time | M | — |
| FR-W-03 | Duration reality (A: Workout Duration Reality Engine, reconstruction) | Honest time | VERIFIED_PASS | `Logic.durationBreakdown`, `estimateMinutes` | `ramp_test`, `e2e_stageA` | — | — | Shown minutes = computed | S | Flag big displayed/computed gaps in the CMS |
| FR-W-04 | Active workout, timers, auto mode | Guided session | VERIFIED_PASS | `run.js`, `run_setup.js` | `e2e_m11_run` | — | Safe Stop Path on pain | Timers correct | M | — |
| FR-W-05 | Plan Integrity Gate (A) | Constraints respected | VERIFIED_PASS | `gate.js` | `e2e_m12_gate` | — | Independent validator | Block / warn issues shown | M | — |
| FR-W-06 | Constraint Conflict Resolver (A) | Clear choices | VERIFIED_PASS | `gate_ui.js` | `e2e_m12_gate` | — | — | Conflict explained with options | S | — |
| FR-W-07 | Session state machine and recovery contract (A, reconstruction) | No lost or double sessions | IMPLEMENTED (VERIFIED_PASS, emulation; screen lock / OS suspension NEEDS_MANUAL_DEVICE_TEST) — docs/WORKOUT_SESSION_STATE_MACHINE.md | `run.js` (save after each action, resume, park) | `e2e_m11_run`, `e2e_stageD` | `fit30.session` | Duplicate completion is guarded by the log | Documented state table + expiry | M | Write the state table, expiry and corrupted-state tests |
| FR-W-08 | Adaptive difficulty (rule-based) | Progress safely | VERIFIED_PASS | `adapt.js` | `stageF_test`, `e2e_stageF` | logs | Never auto-raises intensity on completion alone | Explained suggestions | M | — |
| FR-W-09 | Equipment substitutions / Equipment Passport | Train anywhere | PARTIAL | exercise swap | `e2e_m11_meals` (swaps), `stageG_test` | — | — | Equipment changes the plan | M | TD-03 |
| FR-W-10 | Travel mode | Real-life adaptation | VERIFIED_PASS | travel sheet, `signature.js` | `stageG_test` G5, `e2e_m12_gate` | — | No location needed | — | S | Plan My Trip: NOT_FOUND / DEFERRED |

## Nutrition

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-N-01 | Food table with provenance | Trustworthy values | VERIFIED_PASS (15 new foods via FDC mirrors) | `nutrition.js` (`src`, `chk`) | `nutrition_v2_test`, `content_test` | USDA SR Legacy | No invented values | Each new food has an FDC id | S | Direct FDC check |
| FR-N-02 | Deterministic menu engine (v2) | Realistic days | VERIFIED_PASS | `mealplanner.js` | `nutrition_v2_test`, `stageH1_test`, `e2e_menu_structure` | targets, prefs | Allergies across all slots | 4 profiles × 30 days | L | — |
| FR-N-03 | Meal journal (mark / undo / partial / repeat) | Accurate intake | VERIFIED_PASS (test fixed, root cause proven) | `screens_nutrition.js`, `core.js` | `e2e_meal_journal` | — | — | Stored = shown | S | — |
| FR-N-04 | Swaps, grocery list, fridge | Practical cooking | VERIFIED_PASS | `meal_options.js`, `screens_shopping.js`, `screens_fridge.js` | `e2e_m11_meals`, `e2e_grocery`, `e2e_fridge` | — | — | Totals recalculated | M | — |
| FR-N-05 | Nutrition Calculation Trace (A) | Auditable numbers | PARTIAL | ingredient sums; recipe page shows per-ingredient values | `nutrition_v2_test` | — | — | Per-calculation trace (food id, source, g, formula version) | M | Add a trace object to `Logic.recipeMacros` and show it |
| FR-N-06 | Data freshness and provenance watch (A) | Stale data visible | NOT_FOUND | — | — | needs source dates | — | Dashboard of stale or unverified foods | M | Admin view from `src` / `chk` |
| FR-N-07 | Food photo / barcode | Faster logging | NOT_FOUND / BLOCKED | — | — | Needs a real vision model or barcode database | Privacy | No fake recognition | L | Deferred until the AI decision |
| FR-N-08 | Cuisine ≠ location; consent-based local discovery (A) | Global users | VERIFIED_PASS | `core.js` prefs, `screens_food_near.js` | `e2e_food_global`, `e2e_m104_fixes`, `location_scan` | — | Location only on tap | — | S | — |

## Coach, AI, help

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-A-01 | Sofit local coach (rules) | Grounded answers | VERIFIED_PASS | `coach_ask.js` | `e2e_m11_coach` | local data | Labelled "לא AI" | No invented answers | M | — |
| FR-A-02 | Central AI service layer, provider registry | Real AI later | NOT_FOUND | — | — | Provider decision | Key server-side only | Status "not configured" shown; local fallback | M | After approval (`docs/AI-INFRA-AUDIT.md`) |
| FR-A-03 | AI Studio / natural-language admin | Faster ops | BLOCKED | — | — | FR-A-02 | No shell / SQL / production writes | — | L | — |
| FR-A-04 | Agent workforce / orchestrator (product agents) | Continuous QA | PARTIAL | `tools/qa/run_qa.js` (7 deterministic QA roles), `qa-daily.yml` | `run_qa` report | — | No production access | Deterministic orchestration | M | Extend roles; no model routing |
| FR-H-01 | Help centre and tutorials (works without AI) | Self-service | VERIFIED_PASS | `screens_help.js`, tutorials per build | `rc1_test`, `e2e_rc1` | — | — | Searchable; videos from this build | M | — |

## Admin / CMS

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-M-01 | Recipes and exercises CMS | Content without code | VERIFIED_PASS (local) / BLOCKED (live migration) | `admin.js`, `cms_content.js` | `e2e_admin`, `rls_cms_test`, `cms_content_test` | migration `20261025000100` | RLS + checked functions | Draft → publish → rollback | L | Owner applies the migration |
| FR-M-02 | Texts editor | Wording without code | VERIFIED_PASS (local) | `admin_app.js`, `text_catalog.js` | `e2e_app_control`, `cms_app_test` | kind `text` | No markup; tokens kept | — | M | `data-user` marking; tokenised dynamic strings |
| FR-M-03 | Screen layout and navigation | Arrange screens | VERIFIED_PASS (local) | `REG`, `layoutApply`, `navApply` | `e2e_app_control` | kind `layout` | Required parts not hideable | — | M | More screens |
| FR-M-04 | Design tokens, contrast, presets | Branding | VERIFIED_PASS (local) | `TOKENS`, `themeApply` | `e2e_app_control`, `cms_app_test`, `rls_cms_test` | kind `theme` | No CSS text; server pattern check | — | M | Logo upload (Storage) |
| FR-M-05 | App settings / feature flags | Control modules | VERIFIED_PASS (local) | `checkConfig`, `isOff`, notice | `e2e_app_control` | kind `config` | No auth bypass | — | S | Internal cohorts (FR-X-01) |
| FR-M-06 | Audit log | Accountability | VERIFIED_PASS (local) | `cms_revisions`, `cms_audit_list` | `rls_cms_test`, `e2e_app_control` | — | Read-only via API | — | S | — |
| FR-M-07 | Media upload library | Images and videos | BLOCKED | inventory only | `e2e_admin` | Storage bucket | SVG / script risk documented | — | M | `docs/CMS-STORAGE-SETUP.md` |
| FR-M-08 | Users / entitlements admin | Support | NOT_FOUND | — | — | entitlement model | Server-side only | — | L | After FR-B-01 |

## Business, platform, other

| ID | Feature | User value | State | Implementation | Tests | Dependencies / data | Security / risk | Acceptance | Cx | Next |
|---|---|---|---|---|---|---|---|---|---|---|
| FR-B-01 | Subscriptions / entitlements / payments | Revenue | NOT_FOUND | — | — | Payment provider (approval) | No card data | No fake purchases | L | Owner decision |
| FR-B-02 | Product analytics (aggregate) | Learn what works | NOT_FOUND | — | — | Privacy decision | No health data in analytics | — | M | Design first |
| FR-X-01 | Experiments / cohorts / rollout | Safe changes | PARTIAL | CMS preview + module flags | `e2e_app_control` | — | — | Cohorts | M | — |
| FR-P-01 | HealthKit / Health Connect | Automatic steps | BLOCKED | `native/` scaffolding only | — | Native build | Consent | — | L | Native project |
| FR-P-02 | Calendar | Scheduling | PARTIAL | `.ics` export | `e2e_m11_sync` | — | — | Two-way sync: NOT_FOUND | M | — |
| FR-P-03 | Steps (manual / CSV) | Activity goals | VERIFIED_PASS | `activity.js` | `activity_test`, `e2e_activity` | — | No fake defaults | — | S | — |
| FR-P-04 | Hydration (litre quick-add) | Daily water | VERIFIED_PASS | `core.js` | `e2e_activity` / qa-agents tests | — | — | — | S | — |
| FR-L-01 | Localization (full i18n) | Global users | PARTIAL | `i18n.js` (11 keys), CMS text overrides with English | `e2e_i18n` | — | Safety texts need review | Keys + completeness check | L | Key migration |
| FR-S-01 | Community / social | Motivation | DEFERRED | — | — | Moderation and privacy model | Health data private by default | — | L | Not before the core |
| FR-R-01 | Release Evidence Bundle (A) | Trustworthy releases | PARTIAL | master doc §16 + ZIP checks | — | — | — | One file per release | S | Generate a bundle file per run |

## Intelligence & Product Expansion (directive of 25.10.2026, audited against the code)

| ID | Feature | State | What exists (evidence) | Gap / next |
|---|---|---|---|---|
| FR-E-01 | Workout Builder (user-built workouts) | IMPLEMENTED (VERIFIED_PASS, emulation) — see the implementation table below | Plans from templates, exercise swaps, programs (`plans.js`, `screens_programs.js`; `e2e_stageB`) | Free builder: search/pick exercises, sets/reps/rest, order, favourite, duplicate, edit, guarded delete, expected duration, equipment, conflict warning, revert to original. Rules: no unknown exercise, sane ranges, estimate labelled; completed history never rewritten. |
| FR-E-02 | Smart Exercise Substitution | IMPLEMENTED (VERIFIED_PASS) — see the implementation table below | Swap with alternatives from the library; future-scope swaps recorded in the plan (`plans.js` `replace`, `e2e_stageB`/`e2e_m12_gate`) | Rank by equipment, level and goal; "no suitable alternative" state; duration recalculated and shown; tests before, mid and saved workout. |
| FR-E-03 | Personal records & progress | PARTIAL | `#/records` (records and milestones), progress screen, measures (`e2e_stageG`, `e2e_stageD`) | Only measured metrics; show the basis of each conclusion. |
| FR-E-04 | Weekly review | VERIFIED_PASS (deterministic) | `#/review` weekly summary (`e2e_stageG`) | AI wording only after an AI provider is approved; must separate facts from interpretation. |
| FR-E-05 | Grocery list | VERIFIED_PASS | `screens_shopping.js`: from the menu for N days, merged quantities, check items, add/delete custom items, copy, clear (`e2e_grocery`) | Saved past lists; categories; meal-prep mode (storage guidance only from reliable sources). |
| FR-E-06 | Food image / barcode | BLOCKED | No vision model, no barcode database connected | Never fake recognition; manual entry stays. |
| FR-E-07 | AI Regression Lab | NOT_FOUND (no AI) | Deterministic coach tests (`e2e_m11_coach`) | Case bank with id, input, synthetic context, expected, prompt version and status — built together with FR-A-02. |
| FR-E-08 | Support Copilot | NOT_FOUND | Bug reports stored per user (`bug_reports`, `screens_beta.js`) | Search of guides and known bugs; drafts only, human sends. |
| FR-E-09 | Content Licensing Registry | PARTIAL | `media_build.js` refuses assets without source and licence; `MEDIA-MANIFEST.json`; credits shown (`stageE_test`) | Admin view with licence, expiry and status; block publishing of unlicensed assets (needs FR-M-07). |
| FR-E-10 | Privacy centre & data controls | IMPLEMENTED (VERIFIED_PASS, emulation) — see the implementation table below | Legal/privacy drafts (`#/legal`), account deletion (`delete_my_account`, typed confirmation), local wipe, what is not stored in the account (`screens_account.js`; `e2e_account`) | One screen listing data types, active integrations ("no AI provider"), export and deletion effects. |
| FR-E-11 | Data export | IMPLEMENTED: JSON backup + CSV per category (VERIFIED_PASS) — see the implementation table below | JSON backup of all local data (`App.exportBackup`; photos excluded, stated) (`e2e_stageB`) | CSV per domain; server-side export of the synced copy. |
| FR-E-12 | Reliability & recovery centre | PARTIAL | Admin "מצב מערכת" (real connections only), save-failure handling (`e2e_savefail`), recovery docs in `docs/MASTER_PROJECT_STATE.md` | Error and test-result feeds need a data source (none connected; shown as such). |
| FR-E-13 | Feature rollout / internal preview | PARTIAL | CMS drafts, live preview iframe, module switches, rollback (`e2e_app_control`) | Test accounts / cohorts; release notes per publish. |
| FR-E-14 | Change Impact Analyzer | PARTIAL | Recipe "מה זה משנה?" runs the real engine (4 profiles × 14 days); diff before publish | Code-change impact report per commit (files → suites map). |
| FR-E-15 | Accessibility regression | PARTIAL | Contrast tokens, 44 px targets, aria labels, focus kept on CMS move buttons; `e2e_m10_ux` | Automated axe-style checks per screen; screen-reader and zoom tests are manual. |
| FR-E-16 | Time zone & scheduling integrity | PARTIAL | One time source: the device's local date (`Store.today()` = local Y-M-D; `diffDays` rounds, so DST-safe) | Travel across zones and sessions across midnight: no explicit test yet. |
| FR-E-17 | Offline & sync integrity | VERIFIED_PASS (local) | Local-first writes; sync with conflict choice (`e2e_m11_sync`); offline reload (`e2e_meal_journal`); "saved locally" vs account state shown | Retry limits documented in `account.js`. |
| FR-E-18 | Smart notifications | NOT_FOUND | `.ics` reminders only | In-app notices first (CMS notice exists); no paid push. |
| FR-E-19 | Business metrics | NOT_FOUND | No analytics source (Admin shows "לא מחובר") | Define metrics first; never show registered users as active users. |
| FR-E-20 | Data Quality Agent | PARTIAL | `content_test` (11k checks), `audit.js`, `nutrition_v2_test` consistency checks, CMS orphan detection | Report-only agent over CMS rows. |
| FR-E-21 | Product feedback | PARTIAL | Beta feedback / bug reports (`#/feedback`, `bug_reports` RLS; `e2e_planb_feedback`) | Admin triage by topic, severity, feature and status. |
| FR-E-22 | Duplicate prevention / idempotency | PARTIAL | Meal mark: 3 taps → 1 record (`e2e_meal_journal`); workout completion keyed by day (`plans.js` log); CMS publish keyed by version | Water add, plan creation and sync retries: no idempotency key yet. |
| FR-E-23 | Agent permissions matrix | PARTIAL | QA runner roles are read-and-test only (`tools/qa/run_qa.js`) | Written matrix (below). |

## Risk register (evidence-based)

| ID | Risk | Likelihood | Severity | Evidence | Prevention | Recovery | Status |
|---|---|---|---|---|---|---|---|
| R-01 | Loss of user data (local-only users) | Medium | High | Data is in localStorage; a browser clear wipes it | Backup export, opt-in sync, `navigator.storage.persist` | Restore from backup or account | Open (user education) |
| R-02 | Wrong permissions in CMS | Low | High | `rls_cms_test` 72 checks | RLS + checked functions; no table grants | Revoke role; rollback | Mitigated (local); live not applied |
| R-03 | Personal data exposure | Low | High | RLS on profiles / user_state (`rls_test`) | No service key in client; secret scan | — | Mitigated |
| R-04 | Invalid AI output | n/a | — | No AI | Gate + schema before any AI release | — | Not applicable yet |
| R-05 | Wrong nutrition numbers | Low | High | Values only from the food table; 15 foods USDA-verified; trace test | Calculation trace, content tests | Fix food row → all dishes follow | Mitigated; base table partly unverified (no `chk`) |
| R-06 | Unreliable workout timer | Low | Medium | `e2e_m11_run` | State saved each action | Resume on reopen | Mitigated; device test needed |
| R-07 | Registration failures | Medium | High | Hosted mailer refusals seen in M10.3 | Honest errors + recovery (`e2e_account`) | Resend / reset | Mitigated in code; live mail not re-tested (forbidden) |
| R-08 | Sync conflicts | Medium | Medium | `e2e_m11_sync` | Conflict choice, no silent overwrite | Backup snapshot before sync | Mitigated |
| R-09 | Content without source / licence | Low | Medium | `media_build.js` refusal | Licence registry (FR-E-09) | Remove asset | Partially mitigated |
| R-10 | External service dependency | Medium | Medium | Supabase for accounts and CMS | App works offline, CMS falls back to built-in | — | Mitigated |
| R-11 | Unexpected cost | Low | High | No paid service enabled | Zero-cost policy; spend caps to verify on accounts | — | Open: billing state not visible to me |
| R-12 | Uncontrolled CMS change | Low | Medium | Drafts, confirmation, audit | Server checks, contrast checks | Rollback / reset | Mitigated |
| R-13 | Rollback failure | Low | Medium | `rls_cms_test` rollback; migration rollback file | Rollback creates a new version | Migration rollback SQL | Mitigated (local) |
| R-14 | Version mismatch (app vs tutorials, SW cache) | Low | Medium | `rc1_test`, SW build id | Re-record per build; one shell cache | Reload prompt | Mitigated |
| R-15 | Inactive feature shown as active | Medium | Medium | Coach labelled "לא AI"; Admin status page | Status page; registry states | — | Mitigated |
| R-17 | First-load budget headroom | Medium | Medium | `e2e_stageA`: 817,524 B → **787,161 B** after workout mode moved to the on-demand chunk (32.8 KB headroom) | New features load on demand | Move rarely used first-load code to chunks | Mitigated |
| R-18 | Exporting another account's data on a shared device | Low | High | Privacy Center check | Export blocked when the device data owner ≠ signed-in user; sign-out wipes the device | — | Mitigated (simulated owner state in e2e) |
| R-16 | Intermittent tests hiding real failures | Medium | Medium | meal_journal plan-id dependency (fixed) | Tests read the actual day's slots | Isolation runs with screenshots | Mitigated for this case |

## Integration contract registry

| Integration | Purpose | Provider | Auth | Data sent / received | Cost state | Limits / timeout | Fallback | Tests | Status |
|---|---|---|---|---|---|---|---|---|---|
| Supabase Auth + REST | Accounts, sync, CMS | Supabase | Publishable key + user JWT | Profile, state, CMS rows | Plan **not verified** (assumed Free) | 8–15 s timeouts in `account.js` | Local-only mode | `e2e_account`, `e2e_m11_sync`, `rls_*` | Connected in beta builds; CMS migration not applied |
| Netlify hosting | Static PWA | Netlify (Drop) | Owner account | Static files | Plan **not verified** | — | — | — | Live serves an older build |
| Google Fonts | Fonts | Google | none | Font files | Free | — | System fonts | — | Active |
| Maps search ("אוכל בקרבתי") | External search link | Google Maps (link) | none | Query + optional location (on tap) | Free (link) | — | Manual | `e2e_food_global`, `location_scan` | Active, consent-based |
| `.ics` calendar | Reminders | File export | none | Times | Free | — | — | `e2e_m11_sync` | Active (one-way) |
| AI model | Coach / admin | none | — | — | — | — | Local rules | — | Not configured |
| Storage | Media upload | Supabase Storage | — | — | — | — | Read-only inventory | — | Not configured |
| HealthKit / Health Connect | Steps | Native | — | — | — | — | Manual / CSV | — | Needs native app |
| Payments | Premium | none | — | — | — | — | — | — | Not present |

## Agent permission matrix

| Agent (logical) | Read code / docs | Analyse | Draft | Edit code (dev) | Run tests | Change data | Publish | Irreversible |
|---|---|---|---|---|---|---|---|---|
| QA runner (`tools/qa/run_qa.js`) | ✓ | ✓ | report | — | ✓ | local test DB only | — | — |
| Data Quality (report-only) | ✓ | ✓ | fix proposal | — | ✓ | — | — | — |
| CMS editor role | — | — | ✓ drafts | — | — | drafts only | — | — |
| CMS admin role | — | — | ✓ | — | — | through checked functions | ✓ (with confirmation) | — |
| Engineering agent (this session) | ✓ | ✓ | ✓ | ✓ (branch) | ✓ | local only | — | **never without explicit approval** |

No agent can change its own permissions. Production, billing, deploy and deletion always stop for approval.

## Definition of Done

A feature is done only when all applicable items hold:
1. Requirement documented.
2. Behaviour defined.
3. Data defined.
4. Permissions checked.
5. Error states handled.
6. Accessibility checked.
7. Mobile checked (emulation; a device run is listed separately).
8. Automated tests added.
9. Tests run on the delivered commit.
10. No significant regression.
11. Docs updated.
12. Integration status accurate.
13. Limits documented.
14. Evidence produced (`tools/release_evidence.js`).

An item that cannot be run is marked BLOCKED, and the feature then is not VERIFIED_PASS.

## Dependency map (summary)

- AI coach / weekly AI review / AI Regression Lab / Support Copilot / food image → **AI provider decision (FR-A-02)** → privacy and consent.
- Media upload / licence publishing gate / logo → **Storage bucket**.
- Live CMS → **owner applies the migration**.
- Premium / business metrics → **entitlement model + payment provider (approval)**.
- Health data → **native app**.
- Workout Builder → exercise library (exists) + duration engine (exists) + Plan Integrity Gate (exists) → **buildable now**.
- Smart Substitution → equipment metadata (exists in `CATALOG.EX_META`) → **buildable now**.
- Privacy centre / CSV export → local store + account deletion (exist) → **buildable now**.

**Next three highest-value tasks** (no external dependency): FR-E-01 Workout Builder, FR-E-02 Smart Substitution, FR-E-10/11 Privacy centre + CSV export.


## Implementation — 25.10.2026 (Workout Builder, Smart Substitution, Privacy Center + CSV)

| Capability | Status | Where | Evidence | Limits |
|---|---|---|---|---|
| Workout Builder: goal (fat loss, strength, hypertrophy, general, endurance, mobility), 15/30/60 or 10–90 min, level, equipment, weekly sessions, focus groups, favourites, "not for me", no jumping | Implemented | `src/js/builder.js`, `src/js/screens_builder.js` (#/builder, extra chunk) | `builder_test` (generation over 6 goals × 3 times × 4 levels × 3 equipment sets: time, equipment, duplicates, level, reasons), `e2e_builder` | Weekly sessions are used only for advice and a complementary workout, not for a weekly calendar (plans do that). Medical limits are not inferred; the user excludes exercises. |
| Time model | Implemented | `Logic.durationBreakdown` (the runner's own steps: warm-up, work, rests, transitions, cool-down) | `builder_test`: breakdown = shown minutes | Estimate, labelled as such |
| Fit to time | Implemented | `fit()`: trims extra sets → cool-down / warm-up → last exercise → 1 set; or adds sets / a brisk-walk block; every change is written in the notes | `builder_test`, `e2e_builder` | Small catalogue (57 exercises): some combinations are shorter than chosen, and the note says why. |
| Save / reload / edit / reorder / duplicate / favourite / revert to original / guarded delete | Implemented | Store `workouts.custom` (part of backup and sync) | `builder_test`, `e2e_builder` (reload) | — |
| Start in the existing runner, resume after reload, history snapshot, no double log | Implemented | `run.js` (`s.custom`), `customLog` with `runId` | `e2e_builder`, `builder_test` | History never changes when a workout is edited or deleted. |
| Plan Integrity Gate before start | Implemented | `Builder.check` → `Gate.checkWorkout` | `builder_test` (excluded → block; household equipment → warning) | Same severity rules as plans |
| Smart Substitution (one ranking for plans and the builder) | Implemented | `Plans.rank` (`plans.js`); `Plans.alternatives` uses it | `builder_test` (filters, phase, small catalogue, limited equipment, favourites in use, unknown exercise, above-level label), `stageB_test` 328/328, `e2e_m12_gate`, `e2e_builder` | Ranking uses catalogue facts only; no invented alternative. |
| Privacy Center | Implemented | `src/js/screens_privacy.js` (#/privacy) | `e2e_builder` (no-backend build); the account state is simulated in-page for the "foreign owner" case | With a live account, the sync status comes from `Account.state()`. Not checked against the hosted project. |
| CSV export | Implemented | `src/js/export_csv.js` | `builder_test` (quoting, injection, BOM, CRLF, empty/partial/600+ rows, no tokens, no network code), `e2e_builder` (downloaded file content) | Photos not included. No server-side export. Generation is instant, so there is no cancel step. |
| Runner restart bug (open session + new start dropped the plan) | Fixed | `run.js` | `e2e_builder` | — |

## Next directive (Next-Generation Product Intelligence) — stage 0 audit against the code

| Area | Exists today | Status | Next |
|---|---|---|---|
| Unified daily screen + one recommended action with reason | NOW card (`Screens.nowCard`, `insights.js`), "איך נבחר הצעד הבא?" | Partial | Data-freshness label; nutrition / steps / water in one block |
| Daily recommendation engine (train / shorter / walk / recovery / comeback / info only) | `adapt.js` (rules), short versions, Plan B (`#/planb`), travel | Partial | One decision layer with an explanation trace |
| Adaptive progression | `adapt.js` proposals (accept / dismiss / revert, history) — `stageF_test`, `e2e_stageF` | Implemented (rules) | Working weights are not recorded yet |
| Personal records / progress | `#/records`, progress screen | Partial | Metric picker; measured vs. manual labels everywhere |
| Weekly review | `#/review` (rules-based, labelled) | Implemented | — |
| Comeback engine | Plan pause/resume, missed-session move, Plan B | Partial | Reduced week builder; guilt-free wording audit |
| Sofit personality / explanation modes | `display.explain` short/detail (`gate_ui.js`), coach labelled "לא AI" | Partial | Five tone modes; provider-ready interface exists (`CoachAsk.provider`) |
| Onboarding | Setup flow `#/setup` | Implemented | Measure time-to-first-workout locally |
| Session state machine | `run.js` states (running / resting / paused / finished; saved after each action) | Partial | Formal state table + tests (FR-W-07) |
| Offline & sync | Local-first, sync with conflict choice, unsynced indicator | Implemented (local) | Retry limits documented |
| Notifications | None (no push) | Not Configured | In-app only |
| Analytics / business metrics | None | Not Configured | Definitions first |
| Feedback centre | `#/feedback`, `bug_reports` | Partial | Admin triage |
| Accessibility suite | Contrast checks, labels, focus tests in several suites | Partial | Dedicated suite |

## Core user journey audit — 25.10.2026 (Phase 1)

| Step | Implementation | Tests | Finding | Action |
|---|---|---|---|---|
| Registration / login | `account.js`, `screens_account.js` | `e2e_account` 113/113 (local emulator) | Recovery paths exist for every error (M10.3) | — |
| Onboarding / goals | `#/setup` (`screens_plan.js`) | `e2e_stageB`, `e2e_meal_journal` | No defect found | — |
| Plan creation | `plans.js`, `planner.js` | `stageB_test` 328/328, `e2e_stageB` | No defect found | — |
| Workout start | `Run.start` (+ setup sheet, Gate) | `e2e_m11_run`, `e2e_run_state`, `e2e_builder` | Restarting over an open session dropped the plan (fixed in d196e81) | Fixed |
| Progression / completion | `run.js` | `e2e_m11_run`, `e2e_run_state` | Save had no guard against a second trigger (not reproduced) | Guard + state check |
| Nutrition / meal logging | `screens_nutrition.js`, `core.js` | `e2e_meal_journal` 34/34, `e2e_menu_structure` | Swap list could offer the day's other dish (fixed in ea4af30) | Fixed |
| Progress display | progress, records, review | `e2e_stageD`, `e2e_stageG` | No defect found | — |
| Return to an interrupted session | `Run.open` on boot | `e2e_run_state`, `e2e_m11_run` | **Defect:** a session reopened 2 h after the app was closed counted the closed time (showed 2:05:02 active time, which would be saved to the log) | **Fixed:** interrupted state, time stops at the last-seen moment |
| Sync clarity | toasts, account screen, Privacy Center | `e2e_run_state` | Save confirmation did not say where the data was | Now says "on the device" / "sent to the account on the next sync" |
| Chunk loading | `main.js` | all e2e | Two separate loaders for `extra.js` could run it twice (not reproduced) | One loader; the runner refuses a second copy |
