# SoFitGo — Master Requirements Matrix (single source of truth)

Last update: 2026-10-25 · Branch `fix/default-cuisine` · Repo `shlomihadad1/SoFitGo` (private; default branch `main`)

This file supersedes the scattered status notes, which remain as history: `BACKLOG-SOFITGO.md`, `KNOWN-ISSUES.md`, `docs/INNOVATION-PROPOSALS-M8.md`, `docs/M9-SCOPE.md`, `docs/RELEASE-CANDIDATE-M12.md`, `docs/BUG-STATUS-M10.2.md`, `docs/AI-ARCHITECTURE.md` and others. Each requirement lists its evidence. Nothing here is marked done without a test, a file, or a measurement behind it.

## Status legend

| Code | Meaning |
|---|---|
| **V** | Implemented and verified: an automated test passes on the current build (browser = Playwright Chromium/WebKit emulation, never a physical device) |
| **I** | Implemented, not verified |
| **P** | Partially implemented |
| **N** | Not implemented |
| **B** | Blocked by external access, credentials, platform, or owner decision |
| **S** | Superseded or no longer required |

**Device rule.** No feature has been tested on a physical iPhone or Android device. Every "V" comes from desktop browser emulation: Chromium with iPhone 13 emulation, plus WebKit for the suites that support it.

**History rule.** The original conversation history is not available in this environment. Requirements come from this directive, the repository documents and code, and the project notes carried over between sessions. Anything that could not be recovered is marked *unrecovered*.

---

## 1. Project state (Part 1)

| Item | Finding | Evidence |
|---|---|---|
| Repository | `shlomihadad1/SoFitGo`, private (checked through the GitHub API) | `gh api repos/shlomihadad1/SoFitGo` → private: true |
| Branch / HEAD | `fix/default-cuisine`. HEAD is newer than cba830f and includes every later commit, among them ffee56c, 6fd907e and 7e8b31f. `main` has not been merged since PR #3 (50ce8a6) | `git log` |
| Live site | sofitgo.com serves build **e54c7d8bc3**, which is older than this branch. Netlify API: no token, so the site was checked read-only only | earlier read-only checks; no deploy made |
| Build process | `node tools/build.js` → `dist/pwa` (first-load JS + on-demand chunks). Tutorial videos must be re-recorded per build (`tools/tutorials_build.js`) | `tools/build.js`, `rc1_test` |
| Tests | 22 Node suites, 34 browser e2e suites, and local Postgres RLS/rollback/account tests against a local Supabase emulator; the full runner is `tools/run_all.sh` | `tools/run_all.sh`, `tools/qa/run_qa.js` |
| ZIP vs source | A ZIP is produced only from the final commit's `dist/pwa` and checked by build id; see §16 | `sw.js` build id |

---

## 2. Known defects (Part 4)

| # | Defect | Status | Evidence / note |
|---|---|---|---|
| D1 | Safari iPhone: headings, buttons or content disappear (P0-E) | **I** + B | Structural fix in M7: the header paints the status-bar area. Layout tests pass (`e2e_rc1_layout`, `e2e_shell`). **Not verified on a device** (B-1, `SAFARI-DEVICE-CHECKLIST.md`) |
| D2 | Food log: duplicate recipe/entry paths, inconsistent logging | **V** | One logging path with a duplicate warning (`addRecipeEntry`), and an undo toast; `e2e_meal_journal` 33/33, `e2e_beta` |
| D3 | Nutrition goal wording misstates the target | **V** | Target warnings, no "goal reached" before eating, real gap banners; `e2e` (nutrition group), `e2e_menu_structure` |
| D4 | Workout duration ("22 min") not matching the workout | **V** | Duration breakdown from `Logic.durationBreakdown` / `estimateMinutes`; `e2e_stageA`, `ramp_test`, `stageB_test` |
| D5 | Mobile navigation: misplaced or hidden elements | **V** (emulated) | `e2e_rc1_layout` 17/17, `e2e_m10_ux` 143/143 |
| D6 | Summary/weekly views hidden or inaccessible | **V** (emulated) | `e2e_stageG` (weekly review), `e2e_m10_ux` |
| D7 | Netlify badge covering the bottom navigation (B-4) | **P** / B | Documented. Turning the badge off is an owner setting in Netlify (`docs/HOSTING-AND-NETLIFY-BADGE.md`); it cannot be done from the code |
| D8 | Registration/auth errors with no way out | **V** (local emulator) | `e2e_account` 113/113: mail failure, confirmation and expiry paths, each with a recovery action |
| D9 | Data persistence across navigation and reload | **V** | `e2e_savefail`, `e2e_stageB` (backup/restore), `e2e_m11_sync` |
| D10 | Understandable errors and recovery | **V** | `e2e_savefail` 8/8, `e2e_account` |
| D11 | Couscous meal 1,348 kcal and a 2,676 kcal "gap" (screenshots) | **V** fixed | Root cause: the generator scaled a single dish up to ×2.5. Since v2, portions are limited to ×0.75–1.35 (up to ×1.6 for very high targets) and days are built from whole dishes. Guarded by `nutrition_v2_test` ("no oversized dish") |
| D12 | Indian menu by default; location deciding the cuisine | **V** fixed | `e2e_food_global`, `e2e_m104_fixes`, `nutrition_v2_test` §4/§5 |
| D13 | "Meal 1 / Meal 2" labels; protein add-on shown as a meal | **V** fixed | `e2e_menu_structure` |

---

## 3. Brand, identity, UX (Part 3)

| Requirement | Status | Evidence / note |
|---|---|---|
| Brand name SoFitGo | **V** | `e2e_m9_identity` 81/81 |
| Consistent tokens (type, colour, spacing, components) | **I** | `DESIGN-TOKENS.md`, a single `src/css`; not audited visually on devices |
| Realistic Sofit coach character (not an abstract icon) | **P** + B | A coach avatar exists (`e2e_now`: avatar not upscaled). High-resolution approved artwork is missing (B-6) |
| Three different logo directions; tilted-S rejected | **B** | The logo is not approved (B-6/B-6a); the header logo is a cleaned raster placeholder. The new directions need design work and owner choice. Not changed here |
| Hebrew RTL + English LTR | **P** | The app is fully Hebrew RTL. English exists only for the shell labels in `i18n.js` (`e2e_i18n` 8/8). There is no full English UI |
| First open, registration, onboarding, home, navigation, profile, workout, nutrition, progress, settings | **V** (emulated) | `e2e_shell`, `e2e_m10_ux`, `e2e_stageA..H1`, `e2e_account` |
| Subscription screens | **N** | No premium/subscription screen exists in the code (see §12) |

---

## 4. Nutrition engine and recipe database (Part 5)

| # | Requirement | Status | Evidence |
|---|---|---|---|
| N1 | Realistic quantities, steps, serving, nutrition, allergens, tags, meal categories | **V** | 200 v2 recipes (48 breakfast, 105 lunch/dinner, 47 snack). `nutrition_v2_test` §1–2; `content_test` 11,289/11,289 |
| N2 | Values consistent with the ingredients | **V** | Calculated from grams × the food table; `nutrition_v2_test` §3, `rc1_final_test` |
| N3 | Raw vs cooked weights | **V** | Every food states `st` = raw / dry / ready; checked in `nutrition_v2_test` and `stageC_test` |
| N4 | No per-100 g / per-serving / whole-recipe confusion | **V** | Recipes are one serving (`servings: 1`); foods are per 100 g; sums tested |
| N5 | No double counting (ingredients, add-ons) | **V** | Duplicate-ingredient test; the add-on counts only when added (`e2e_menu_structure`, `nutrition_v2_test`) |
| N6 | No inflated single meal | **V** | Portion limits; "no oversized dish" test |
| N7 | Several dishes selected when needed | **V** | 2–3 meals as set, plus up to 2 snacks only when needed |
| N8 | Allergies, restrictions, cuisine, number of meals | **V** | `nutrition_v2_test` §4b/§5, `stageH1_test` 165/165, `e2e_stageH1` |
| N9 | Swap dish → totals recalculated | **V** | `nutrition_v2_test` §6, `e2e_m11_meals`, `e2e_menu_structure` |
| N10 | History preserved when recipes or targets change | **V** | Parameter segments plus `autoSince`; `e2e_menu_structure` ("past days keep the menu") |
| N11 | Real discrepancies shown | **V** | Calorie/protein gap banner. Fat/carb deviations over ±15% are stated on the day (`e2e_menu_structure` "macro deviations shown") |
| N12 | No value manipulation to pass tests | **V** | Values come only from the food table. The 15 new foods were verified against USDA SR Legacy (§4.1) |
| N13 | Research sources documented | **V** | `docs/NUTRITION-SOURCES.md` (7 sources, opened and read) |
| N14 | Default Mediterranean/Israeli; location never decides; explicit Indian → mostly Indian; International → real variety; selector changes the menu | **V** | `e2e_food_global`, `e2e_m104_fixes`, `nutrition_v2_test` §5 |
| N15 | Four regression profiles × 30 days | **V** | `nutrition_v2_test` → `dist/reports/nutrition-v2-test.json`; table in §16 |

### 4.1 The 15 new food values

All 15 were verified on 2026-10-24 against the USDA FoodData Central **SR Legacy** records. Most were read through the getfoodfacts.com FDC mirror; red pepper was read through ReciPal's USDA record. The source id of each is stored in the food's `src` field in `src/data/recipes_med.js`.

| Food | FDC / NDB | Result |
|---|---|---|
| lentils | FDC 172420 | matched |
| barley (pearled) | FDC 170284 | matched |
| sardines (canned in oil, drained) | FDC 175139 | matched; fat 11.5 → 11.4 |
| walnuts | FDC 170187 | matched |
| dates (Medjool) | FDC 168191 | matched |
| beet | FDC 169145 | matched |
| pear | FDC 169118 | matched; carbs 15 → 15.2 |
| grapes | FDC 174683 | matched; carbs 18 → 18.1 |
| watermelon | FDC 167765 | matched |
| butternut squash | FDC 169295 | matched |
| brown rice (raw) | FDC 169703 | **corrected**: 370/7.9/77.2/2.9/3.5 → 367/7.5/76.2/3.2/3.6 |
| whole-wheat pita | FDC 174916 | **corrected**: 266/9.8/55/2.6/7.4 → 262/9.8/55.9/1.7/6.1 |
| hummus (commercial) | FDC 174289 | **corrected**: 166 kcal / 9.6 g fat → **237 kcal / 17.8 g fat**. This is the largest error; the old value was too low |
| olives (ripe, canned) | FDC 169094 | **corrected**: fibre 3.2 → 1.6 |
| red pepper (sweet, raw) | NDB 11821 via ReciPal | **corrected**: 31 → 26 kcal; fibre 2.0, derived from the label (the per-100 g fibre value is not printed on that page) |

The mirror pages are third-party copies of FDC. The FDC site itself was not reachable from this environment, so a direct check of these records on fdc.nal.usda.gov is still recommended.

---

## 5. Workouts, exercises, progress (Part 6)

| Requirement | Status | Evidence |
|---|---|---|
| Exercise library with full instructions | **V** | 57/57 exercises have a start position, steps, breathing, common mistakes and levels (`e2e_content`, `content_coverage`) |
| Categories, muscles, difficulty, equipment, duration | **V** | `CATALOG.EX_META`; `stageA_test` 7,808/7,808 |
| Plans adapted to goal and level | **V** | `plans.js` / `planner.js`; `stageB_test`, `e2e_stageB` |
| 15 / 30 / 60-minute versions | **V** | `Logic.VERSIONS`; `stageA_test`, `e2e_stageA` |
| Warm-up / main / cool-down | **V** | `buildSteps`; `e2e_m11_run` |
| Correct timers and durations | **V** | `e2e_m11_run` 41/41, `ramp_test` |
| History of completed workouts | **V** | `e2e_stageB`, `e2e_stageD` |
| Equipment substitutions | **P** | Exercise swap exists. Advanced equipment does not yet change the plan (TD-03 / Equipment Passport) |
| Media: real vs generated vs missing | **V** (documented) | 57/57 covers are **generated illustrations** (stated in the UI). Real exercise photos: 0. Demonstration videos: **0/57**. Recipe photos, prep videos and step photos: **0**. The app labels this honestly (`e2e_content` "nothing fake") |

---

## 6. Sofit coach (Part 7)

| Requirement | Status | Evidence |
|---|---|---|
| Live AI or local rules? | Local, deterministic rules (`src/js/coach_ask.js`, `insights.js`, `adapt.js`). **No AI model is called.** The UI says so ("לא על ידי מודל בינה מלאכותית") | `e2e_now`, `e2e_m11_coach` 79/79 |
| Personalised from goals, history and nutrition | **V** (rules) | `e2e_m11_coach` |
| Verified data kept apart from inferred data | **V** | Coach answers cite the stored values; estimates are labelled |
| No fabricated data | **V** | Steps "not measured", calories burned "not measured" (B-10) |
| Graceful fallback without an AI service | **V** | Chat is shown as unavailable (B-9) |
| Live AI chat | **B** | Needs a server, a paid model and owner approval (`docs/AI-ARCHITECTURE.md`, decision D-4) |

---

## 7. Video, localisation, media (Part 8)

| Requirement | Status | Evidence |
|---|---|---|
| Tutorial videos that match the current UI | **V** | Re-recorded from each build; `rc1_test` checks that they were "recorded from this build" |
| Exercise demonstration videos | **N** | 0/57. None were purchased or faked |
| Multilingual subtitles / voice-over / AI dubbing | **N** | An architecture proposal is needed. Paid dubbing is not approved |
| Licences | **V** | `media_build.js` refuses assets without source and licence (`stageE_test`) |
| Broken references | **V** | `stageE_test` media mapping, `build_check` |

---

## 8. Steps, health, calendar (Part 9)

| Requirement | Status | Evidence |
|---|---|---|
| Daily / weekly / monthly steps with a personal goal | **V** | `activity_test` 140/140, `e2e_activity` 23/23 |
| Manual entry vs measured, clearly labelled | **V** | The source label is shown; there is no fake 10,000-step default |
| Steps CSV import | **V** | Unit 4 (`d3c0b50`) |
| Apple Health / Health Connect | **B** | A PWA cannot read HealthKit or Health Connect. This needs a native wrapper (`activity_more.js`, path unverified). Nothing claims to be connected |
| Calendar | **P** | One-way `.ics` export only (`sync_tools.js`). **Not two-way sync** |

---

## 9. Travel (Part 10)

| Requirement | Status | Evidence |
|---|---|---|
| Travel Mode (no-equipment swaps, quick meals) | **V** | `stageG_test` G5, `e2e_m12_gate`; travel sheet |
| Location never overrides diet | **V** | `e2e_food_global` |
| Plan My Trip (destination, budget, itinerary, booking links) | **N** | Only the travel hub exists. No fake listings were added. Deferred until the core is stable (Part 10 rule) |
| Food near me | **P** | Opens a maps search after consent; no live data inside the app (`screens_food_near.js`) |

---

## 10. Admin CMS (Part 11)

| Requirement | Status | Note |
|---|---|---|
| Any CMS | **V** (local emulator) / B (live) | Modules: recipes & menus, exercise instructions, media inventory (upload **B**: needs a Storage bucket), roles, history/rollback, 10 guides, code-only settings list. Tests: `rls_cms_test` (server-side authorization, PostgreSQL RLS), `cms_content_test` (loader), `e2e_admin` (browser, local Supabase emulator). **Not applied to the live project** — migration `20261025000100_sofitgo_cms.sql` needs owner approval; see `docs/CMS.md` |
| Backend capacity | **I** | Supabase is already used for accounts (migration `20261020000100`). A local emulator with real Postgres + RLS exists for testing (`tools/supa_local.js`, `tools/pg_local.sh`) |
| Plan | — | Stage D in §15: modules recipes → exercises → media, with roles enforced by RLS, draft/publish, revisions and rollback. Implemented and tested locally only; the live migration needs owner approval |

---

## 10A. Full App Control CMS (directive of 25.10.2026)

The existing `#/admin` was extended in place; nothing was rebuilt. All areas share one server workflow: draft (editor) → validation → live preview → publish with confirmation (admin) → history → rollback or reset to default. The live Supabase project is **not** migrated (needs owner approval), so every "V" below comes from the local emulator: real PostgreSQL 16 with RLS, plus Playwright Chromium/WebKit emulation.

### 10A.1 Audit of earlier fixes (re-checked on this branch)

| Item | Status | Evidence |
|---|---|---|
| First-load budget < 820,000 B | **V** | `e2e_stageA` (budget unchanged). The CMS loader is in `cms.js`, which loads only when content is cached or a backend is configured. |
| Lazy CMS / admin chunks | **V** | `tools/build.js`: CMSC → `cms.js`; ADMIN → `admin.js` (admin.js + admin_app.js); `cms-catalog.js` loads only in the texts tab. |
| Recipe / exercise editor stability (typing never lost, exercise `bad` array) | **V** | `e2e_admin` 40/40 |
| Nutrition calculations from ingredients | **V** | `nutrition_v2_test`, `cms_content_test`, `e2e_menu_structure` |
| Meal journal | **V**. The intermittent crash is explained; see 10A.4 | `e2e_meal_journal` |
| Permissions, history, rollback | **V** (local) | `rls_cms_test` (72 checks), `e2e_admin`, `e2e_app_control` |
| Mobile / WebKit | **V** (emulation only, **not** a device) | WebKit runs in §16 |

### 10A.2 Requirement traceability

| Requirement | Implementation | Schema / config | Evidence | Status | Limitation / dependency |
|---|---|---|---|---|---|
| **A. Global texts:** search by text / key / screen / file | `admin_app.js` `texts()`; catalog `tools/text_catalog.js` → `cms-catalog.js` (≈3,250 app-owned Hebrew strings with files and screens) | `cms_content` kind `text`, id `t_<hash>_<len>` | `e2e_app_control` (texts) | **V** | Only static strings. Text built from a value in code (for example "3 ארוחות") is flagged "משולב בערך משתנה" and may not be replaceable. |
| Where used; single and bulk edit; original / proposed / preview | `textEditor()`, `bulkCard()`; bulk creates **drafts only** | — | `e2e_app_control` (bulk) | **V** | Bulk is capped at 50 per run. |
| Tokens, numbers and `{vars}` preserved; no markup | `checkText` (`cms_content.js`) + `cms_valid` (SQL) | `cms_valid()` | `cms_app_test`, `rls_cms_test` | **V** | — |
| Missing translations / duplicates / unused | Filters "בלי נוסח אנגלי", "בשימוש ביותר ממקום אחד"; orphaned overrides listed | — | UI counts (`data-cms-tcounts`) | **P** | English is a developer preview (`?lang=en`). Only overrides are tracked; the code has no full key system. |
| User content never overwritten | `textApply` skips inputs, textareas, `[contenteditable]`, `[data-user]` and admin screens; only exact whole-node matches | — | `e2e_app_control` (button still works) | **P** | A user-typed value identical to an app string could be matched (no global `data-user` marking yet). |
| Security-critical text not editable | Validation, server and auth errors stay in code (`admin.js`, `account.js` are excluded from the catalog when they hold errors) | — | code review | **P** | The catalog includes `account.js` labels. Server-side messages are not affected. |
| **B. Screen editor:** component registry, order, show/hide, spacing, alignment, nav order | `REG` (`cms_content.js`), `layoutApply`, `navApply`; UI `layout()` with accessible ▲▼ buttons | kind `layout`, ids `home`, `nutrition`, `nav` | `e2e_app_control` (layout, navigation, keyboard focus) | **V** | Supported screens: home, nutrition, bottom navigation. Code-defined parts are listed as such. No drag-and-drop (accessible buttons instead). |
| Required / safety components cannot be hidden | `REG` flag; `checkLayout` `l_hide` | — | `cms_app_test` | **V** | — |
| Preview at mobile and desktop sizes | `frame()` iframe `?cmspreview=1` applies the unsaved rows | — | `e2e_app_control` (preview order) | **V** | Emulation in the admin's browser. |
| No code editor / HTML / JS | Only data with whitelisted values | `cms_valid` | `rls_cms_test` (injection refused) | **V** | — |
| **C. Design tokens:** colours, fonts, sizes, radii, spacing, shadow; contrast; presets; reset; history | `TOKENS`, `checkTheme`, `contrastIssues`, `themeApply`; UI `design()` | kind `theme`, ids `active`, `preset_*` | `cms_app_test`, `e2e_app_control` (design), `rls_cms_test` | **V** | Dark theme only; a light theme is accepted only if every contrast pair passes. 9 hex colours in components and 28 in JS illustrations stay fixed. |
| Logos, coach artwork, illustrations | — | — | — | **B** | Needs Storage (D). |
| **D. Media library** (search, metadata, usage, replace, safe delete, upload) | Read-only inventory (`admin.js` `media()`) | Setup in `docs/CMS-STORAGE-SETUP.md` (bucket, policies, size and type limits) | `e2e_admin` (blocker shown) | **P / B** | Upload is **not** claimed. It needs the `cms-media` bucket and approval. |
| **E. Content operations:** recipes, nutrition, exercises | Existing editors | kinds `recipe`, `exercise` | `e2e_admin` | **V** | Food values, new exercises and motion figures stay in code. |
| Meal plans / dietary defaults | Settings: default meals (2/3), flex meal | kind `config` | `cms_app_test`, `e2e_app_control` | **V** | Targets, formula and portion limits are code-only (safety). |
| Video / tutorial catalogue, coach content, travel content | Text overrides only | `text` | — | **P** | No dedicated editors; tutorials are recorded per build. |
| **F. Feature and config control:** module switches, defaults, notice, effect timing | `checkConfig`, `isOff`, `post()`; UI `settings()` with a timing table | kind `config`, id `app` | `e2e_app_control` (settings) | **V** | 7 modules can be switched off. The table lists what needs a rebuild or is external (Storage, Health, AI, payments, push). |
| **G. Permissions, RLS, no self-grant** | Unchanged model, extended to the new kinds | `cms_*` functions | `rls_cms_test`, `e2e_app_control` (403s) | **V** (local) | Live migration needs approval. |
| Audit log (who / what / when) | `cms_revisions` (publish, archive, restore, rollback, grant, revoke) + `cms_audit_list()`; UI `audit()` | `cms_audit_list(integer)` | `rls_cms_test`, `e2e_app_control` (audit) | **V** | Saving a draft is not logged. |
| Stale edits / concurrency | `base_version` check in `cms_publish` | — | `rls_cms_test` | **V** | — |
| Destructive confirmations | Publish, reset and bulk sheets need a checkbox | — | `e2e_app_control` | **V** | — |
| **Phase 3:** invalid publication never corrupts | Server `cms_valid`; app validates every row and ignores invalid ones | — | `e2e_app_control` (corrupted row → built-in values) | **V** | — |
| Remote content unavailable → fallback; offline cache | `fit30.cms` cache; offline reload applies the cache | — | `e2e_app_control` (offline, service worker) | **V** | — |
| No flash of built-in content | `main.js` boot waits up to 1.5 s for `cms.js` when a cache exists | — | `e2e_app_control` (first paint) | **V** | First visit on a new device shows built-in content until the first fetch (no cache yet). |

### 10A.3 Prioritised gaps

1. **Live activation (B):** apply the CMS migration and add the owner row (owner approval).
2. **Media upload (B):** Storage bucket and policies (`docs/CMS-STORAGE-SETUP.md`), then the upload UI and metadata kind.
3. **Text coverage (P):** mark user-content spots with `data-user` globally, and move dynamic sentences to tokenised i18n keys (`{n} ארוחות`) so they become editable.
4. **More screens in the layout registry (P):** progress, workouts, settings.
5. **Dedicated editors (P):** tutorials catalogue, coach prompts, travel content.
6. **Real-device testing (N):** iPhone Safari and Android Chrome.

### 10A.4 Intermittent `e2e_meal_journal` crash: investigation

- **Symptom:** in the full run on 34cf44a the suite crashed at a click (30 s timeout) in group "A · undo and unmark". It passed when run alone.
- **Reproduction:** the slot list was logged at the failing step. The original test clicks `[data-slot=snack]`. In 3 of 4 reproduced runs the day had **no snack** (`uneat:m1 uneat:m2 eat:m3`).
- **Cause:** the v2 menu engine adds a snack only when the day needs one. The menu is seeded by the plan id, which is random per test run. The failure therefore depends on the plan id, not on load, timing or the CMS. Isolation runs against three builds are recorded in §16.
- **Fix (test only, justified):** the third meal is the slot that is actually still unmarked, with a check that it exists. No timeout was changed. Other suites that checked allergy and cuisine leaks only on m1, m2 and snack now check all five slots.

---

## 11. Accounts, persistence, monetisation (Part 12)

| Requirement | Status | Evidence |
|---|---|---|
| Registration, login, recovery | **V** (local emulator) | `e2e_account` 113/113; live: email confirmation on (read-only check) |
| Profiles, settings, progress persistence and sync | **V** | `e2e_m11_sync`, `rls_test` 55/55 |
| Free / premium plans, entitlements, payments | **N** | No code exists. Activating payments requires approval (none given) |

---

## 12. Sofit Life Loop ideas (Part 2)

The 43-idea master list (13 original + 30 added) is **not stored in the repository**. Some INN numbers survive in commit notes and docs: INN-01, 02, 03, 07, 08, 09, 15, 16, 17/18, 22, 24, 25, 30, 33, 41 and 43. The idea names below come from `BACKLOG-SOFITGO.md` and `docs/INNOVATION-PROPOSALS-M8.md`. Where an INN number is not attested, the cell says "—". The exact original wording of all 43 is **unrecovered**, and no wording was invented.

| Idea | INN | Status | Evidence / gap | Priority |
|---|---|---|---|---|
| SofitGo NOW card | — | **V** (1st slice) | `e2e_now` 17/17; missing: time of day, energy, beginner wording | P1 |
| Contextual Shortcuts v2 | INN-33 | **P** | NOW card chips; selection by state/time still open | P1 |
| Minimum Mode (1/3/5/8 min) | INN-02 | **B** | Needs reviewed content and a rule for recording partial workouts | P1 |
| Sofit Flex (15/30/60, swaps, low energy) | INN-01 | **P** | Versions and swaps verified; choice by equipment, place and day schedule missing | P1 |
| Plan B hub ("I don't have X") | INN-07 | **P** | `screens_beta.js`, `e2e_planb_feedback` 16/16 | P1 |
| Fridge-to-Meal | INN-03 | **V** | `screens_fridge.js`, `e2e_fridge` 12/12 | P1 |
| Smart Grocery Loop (v2: home / not found / bought; user items) | INN-08 | **V** v2 / **N** v3 | `e2e_grocery` 13/13. v3 (swaps for "not found") not done | P1 |
| Recipe Quality Gate | INN-41 | **V** | `tools/recipe_gate.js` 344/344 | P1 |
| Data Confidence Labels | — | **P** | "Estimate ±%" labels; "values estimated" lines | P2 |
| Explain My Plan | — | **V** | `stageG_test` G1, explanation mode (M12) | P2 |
| Adaptive Recipe Scaling | — | **V** | Portion limits, portion sheet, swap scaling | P2 |
| No-Shame Comeback | INN-30 | **P** / B | Adapt R-DOWN after gaps; load rules need professional review (DR-01) | P2 |
| Recovery Choice (rest / walk / mobility) | INN-22 | **P** | Rest-day guidance; new routines blocked by content review | P2 |
| One-Tap Weekly Reset | INN-25 | **P** | Weekly review screen exists; single reset action with preview not done | P2 |
| Smart Leftovers / Meal Prep Planner | — | **P** | Meal-prep tags (46 v2 recipes) and a shopping-list prep section | P2 |
| Budget Mode | — | **P** | Relative cost rating (1–3) and 87 budget-tagged recipes; no prices (none invented) | P2 |
| Equipment Passport (INN-17/18) + Quiet & Small-Space | INN-17/18 | **P** | Equipment list in setup; plans do not yet change by place (TD-03) | P2 |
| Travel Mode | — | **V** | §9 | P2 |
| Offline Travel Pack | INN-24 | **P** | Offline readiness check; pre-caching pack not done | P2 |
| User-Controlled Sofit Memory | INN-09 | **N** | Needs a consent/delete model first | P2 |
| Personal Pattern Finder / Friction Radar | — | **N** | Same consent dependency | P3 |
| Restaurant Copilot / Local Food Translator | — | **B** | Need an AI service and approval | P3 |
| Shared Household List | — | **B** | Needs server lists and sharing | P3 |
| One-Day Autopilot, Life Score, Ripple Effect | — | **N** | Proposed only | P3 |
| Low-Data Mode | — | **P** | Media load on demand | P3 |
| Wearables | INN-15/16? | **B** | Native integration needed (§8); the number mapping is unsure | P3 |
| Coach Tone Selector, Micro-Learning Cards, Preference Presets | — | **N** | Proposed only | P3 |
| Safe Stop & Escalation | — | **P** | Stop guidance in workouts | P3 |
| Transparent Change Log | — | **P** | Plan change log | P3 |
| Beta Feedback Button | INN-43 | **V** | `e2e_planb_feedback` | P3 |
| Widgets, voice, animation | — | **N** | Native/OS features | P3 |
| *Remaining ideas, up to 43* | — | *unrecovered* | Not in any available file | — |

### 12.1 Other requests from the same period

| Request | Status | Evidence |
|---|---|---|
| Hands-free workout mode (Unit 1) | **V** | `a879bed`; `e2e_m11_run` |
| Sofit local coach (Unit 2) | **V** | `e2e_m11_coach` |
| Meal personalisation (Unit 3) | **V** | `e2e_m11_meals` |
| Steps CSV import, plan `.ics` export (Unit 4) | **V** | `d3c0b50` |
| Plan Integrity Gate, conflict resolver, explanation mode, Travel Mode extension (M12) | **V** | `e2e_m12_gate` 30/30 |
| Default cuisine, regional match by consent only, one shared cuisine state | **V** | `e2e_food_global` 29/29 |
| Full exercise/recipe written guidance | **V** | `e2e_content`, `content_coverage` 745/745 |
| Menu structure: day-part meals, optional add-on | **V** | `e2e_menu_structure` |
| Nutrition engine from targets (macro-aware) | **V** | `nutrition_v2_test` |
| Nutrition DB v2 (200 recipes, sources) | **V** | §4 |
| Admin CMS (two specs, incl. guides and impact explanations) | **V** locally / B live | §10, `docs/CMS.md` |
| SMTP/email | **S** | The owner confirmed email works and asked not to re-check it |

---

## 13. Cross-platform testing (Part 13)

| Target | Status |
|---|---|
| Desktop browser (Chromium) | **V**: full suite (§16) |
| iPhone Safari | **Emulated only.** WebKit (Playwright) runs for 9 suites plus iPhone 13 viewport emulation. No physical device |
| Android Chrome | **Emulated only.** Chromium mobile emulation. No physical device |
| Admin authorization and publishing | **V** on the local emulator (Chromium iPhone 13 emulation + 1280 px desktop); not on the live project or a device |

---

## 14. Dependency map (main)

- **CMS** → Supabase migration (owner approval to apply live) → content loader in the app → admin UI → Storage bucket (media module; blocked until a bucket is configured).
- **Health integrations / widgets / voice** → native wrapper (Capacitor or similar) → device testing.
- **AI chat, Restaurant Copilot, Local Food Translator** → server + model provider + cost approval.
- **Premium** → entitlement model + payment provider + approval.
- **Minimum Mode, No-Shame Comeback load rules, Recovery routines** → professional content review (DR-01).
- **Logo / coach artwork** → design deliverables + owner choice.

## 15. Execution plan (this branch)

| Stage | Work | State |
|---|---|---|
| A | This matrix | done (this file) |
| B | Critical fixes: no open P0 known; nutrition correctness (D11–D13, 15 USDA values) | done |
| C | Core completion items that need no external decision (Contextual Shortcuts v2, Grocery v3, Weekly Reset) | queued after D |
| D | CMS: recipes + exercises + roles + history/rollback + guides + media inventory | done locally (V on emulator); live activation and media upload blocked on owner approval |
| F/G | Full regression, emulated mobile, ZIP | §16 |

## 16. Test results and delivery

Filled in for each delivery. See the latest entry at the end of this file.

### Delivery — commit 34cf44a, build 215f134837 (CMS integrated)

The test results below were all run on this final build. The pre-CMS results, which were run on build a681ddaaca, no longer apply.

| Check | Result |
|---|---|
| Full regression (`tools/run_all.sh`, 62 suites) | 61 suites passed; 26,642 checks, 0 failures. One suite failed. |
| Failed suite | `e2e_meal_journal` crashed once with a click timeout during the full run. Re-run on its own on the same build, it passed twice (33/33). It is recorded as a timing failure under load and remains open. |
| WebKit engine (`BROWSER=webkit`, Playwright emulation, **not a real device**) | `e2e_menu_structure` 41/41, `e2e_content` 9/9, `e2e_m11_meals` 31/31, `e2e_food_global` 29/29, `e2e_m104_fixes` 104/104, `e2e_admin` 40/40 |
| Server-side CMS security (real PostgreSQL 16 + RLS, local emulator) | `rls_cms_test` 54/54 |
| CMS behaviour verified in `rls_cms_test` | No self-grant; no owner via the API; an editor cannot publish; a reviewer is read-only; drafts and history are private; a stale draft is refused; history covers publish, archive, restore and rollback; a revoked role takes effect immediately |
| CMS flow in the browser | `e2e_admin` 40/40: edit, then preview and validation, publish, the app shows the new content, rollback, the app follows the rollback, archive |
| First-load budget | 806,849 B, under the 820,000 B budget. To get there, the CMS loader was moved to an on-demand `cms.js` and the validation texts to `admin.js` (it had been 824,212 B). The budget itself is unchanged. |
| ZIP | `sofitgo-beta-215f134837-34cf44a.zip` (3,009,363 B). `unzip -t` passed. The build id in `sw.js` and `index.html` matches. `cms.js` and `admin.js` are included. No secret keys found. |

**Not done or not testable here:**
- The CMS migration has not been applied to the live Supabase. This needs the owner's approval.
- Media upload is blocked; it needs a Storage bucket.
- Nothing was tested on a real device.
- No merge to main and no deploy.

### Delivery: commit ea4af30, build 4dd8403194 (full app control CMS + fixes), 25.10.2026

All results below were run on this commit and build. The earlier entries are history.

| Run | Result |
|---|---|
| Full regression `tools/run_all.sh` on ea4af30 | **65/65 suites pass.** 26,797 checks, 0 failed, 0 crashed, 0 timed out, 0 not run. Bundle: `docs/release/RELEASE-EVIDENCE-4dd8403194.md` (generated from the runner output by `tools/release_evidence.js`). |
| `e2e_meal_journal`, run alone (no competing suites) | 3/3 runs pass (34/34 each) |
| WebKit (Playwright emulation, **not a device**) | `e2e_menu_structure` 42/42, `e2e_content` 9/9, `e2e_m11_meals` 31/31, `e2e_food_global` 29/29, `e2e_m104_fixes` 104/104, `e2e_app_control` 62/62 |
| First load | 808,378 B (< 820,000 budget, unchanged); `e2e_stageA` 87/87 |
| ZIP | `sofitgo-beta-4dd8403194-ea4af30.zip`, 3,126,802 B, `unzip -t` OK, `sw.js` / `index.html` build 4dd8403194, contains `cms.js`, `admin.js`, `cms-catalog.js`, no secret keys |

**Runs on earlier commits of this delivery (kept as evidence):**

| Commit | Result | Classification |
|---|---|---|
| 34cf44a | `e2e_meal_journal` crashed once in the full run, passed alone | **Intermittent.** Root cause: the test hard-coded a snack slot. |
| Isolation of the original test, 6 sequential runs each | build 81f6ff6ac7 (with CMS) 0/6 pass; a681ddaaca (e315588, before CMS) 2/6; a63a5b51cc (7354a19, before v2 engine) 6/6 | Started with the v2 menu engine, **not the CMS**. Stack trace: waiting for `[data-slot=snack]`, line 67. Screenshots and state were saved for every failure. |
| 8bb9029 | 63 suites pass; **`stageH1_test` crashed** (TypeError reading `ing`) | Same root cause. It became visible when the date changed to 25.10 (no snack that day). Test fixed in 58b84c4. |
| 58b84c4 | 63 suites pass; **`e2e_menu_structure` failed 1/41**: the same dish appeared twice after a swap | **Functional bug**, intermittent (depends on the day's menu). The swap list could offer the day's dinner dish for lunch. **Code fixed** in ea4af30 (`meal_options.js`); the test now checks every option of the real list. |

**Not run / not testable here:**
- physical iPhone and Android devices;
- the live Supabase project (CMS migration not applied — needs approval);
- Storage uploads (no bucket);
- any AI provider (none configured).

No merge to `main`, no deploy, no Production or live Supabase change, no costs.

### Delivery: code commit d196e81, build e8c3bccbd4 (Workout Builder, Smart Substitution, Privacy Center + CSV), 25.10.2026

| Run | Result |
|---|---|
| Full regression `tools/run_all.sh` on d196e81 | **67/67 suites pass.** 0 failed, 0 crashed, 0 timed out, 0 not run. Checks counted from the suites' own summaries: 26907 passed, 0 failed.. Bundle: `docs/release/RELEASE-EVIDENCE-e8c3bccbd4.md`, generated after the docs-only commit 6e24665; the code is identical to d196e81. |
| New tests | `builder_test` 59/59; `e2e_builder` 45/45, which checks the downloaded CSV content |
| WebKit (Playwright emulation, **not a device**) | `e2e_builder` 45/45, `e2e_menu_structure` 42/42, `e2e_content` 9/9, `e2e_m11_meals` 31/31, `e2e_food_global` 29/29, `e2e_m104_fixes` 104/104, `e2e_app_control` 62/62 |
| First load (network-measured, `e2e_stageA`) | 817,524 B, under the 820,000 B budget (unchanged). It had reached 822,339 B with the shared substitution code. It went back under by shipping derivable cover-image fields compactly; all 57 media records were verified identical after expansion. |
| Security / privacy | CSV export makes no network call and contains no tokens (unit test). Formula injection is neutralised. Export is blocked for another account's device data (account state simulated in the page). Server isolation is covered by `rls_test`. The secret scan in `build_check` passes. |
| ZIP | `sofitgo-beta-e8c3bccbd4-d196e81.zip`, 3,150,580 B, `unzip -t` OK, `sw.js` / `index.html` build e8c3bccbd4, no secret keys |

**Not run:**
- physical devices;
- the hosted Supabase project (the privacy screen's account statements were tested only with local and simulated state).
