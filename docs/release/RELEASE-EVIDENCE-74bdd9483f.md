# Release Evidence: build 74bdd9483f

- Commit: `66a773a4ba5c047bc474aab2a76034875cfac990` (fix/default-cuisine); working tree clean
- Generated: 2026-10-25T11:49:09.926Z from `run-d246052.log` (the actual runner output)
- Environment: local container, Node v22.22.0. Browsers are Playwright Chromium/WebKit **emulation**, not physical devices. The backend is a local PostgreSQL 16 emulator, not the hosted project.
- Command: `sh tools/run_all.sh`
- index.html size: 777433 B (the first-load budget, including network, is asserted by e2e_stageA)
- ZIP: sofitgo-devtest-74bdd9483f-d246052.zip · 3143913 B · unzip -t OK · sw.js build 74bdd9483f

| Result | Suites |
|---|---|
| PASS | 70 |
| FAIL (assertions) | 0 |
| CRASH (runner crash) | 0 |
| TIMEOUT | 0 |
| NOT_RUN | 0 |

Checks counted from the suites' own summaries: 27035 passed, 0 failed.

| Suite | Result | Pass | Fail | Runner line |
|---|---|---|---|---|
| build_check | PASS | 187 | 0 | build checks: pass 187 fail 0 |
| content_test | PASS | 11289 | 0 | content tests: pass 11289 fail 0 |
| nutrition_v2_test | PASS | 69 | 0 | nutrition v2 tests: pass 69 fail 0 |
| cms_content_test | PASS | 17 | 0 | cms content tests: pass 17 fail 0 |
| cms_app_test | PASS | 32 | 0 | cms app-control tests: pass 32 fail 0 |
| builder_test | PASS | 59 | 0 | builder tests: pass 59 fail 0 |
| run_state_test | PASS | 28 | 0 | run state tests: pass 28 fail 0 |
| stageA_test | PASS | 7808 | 0 | stage A tests: pass 7808 fail 0 |
| stageB_test | PASS | 329 | 0 | stage B tests: pass 329 fail 0 |
| stageC_test | PASS | 2763 | 0 | stage C tests: pass 2763 fail 0 |
| stageD_test | PASS | 49 | 0 | stage D tests: pass 49 fail 0 |
| stageE_test | PASS | 1501 | 0 | stage E tests: pass 1501 fail 0 |
| stageF_test | PASS | 48 | 0 | stage F tests: pass 48 fail 0 |
| stageG_test | PASS | 47 | 0 | stage G tests: pass 47 fail 0 |
| stageH1_test | PASS | 166 | 0 | stage H1 tests: pass 166 fail 0 |
| rc1_test | PASS | 87 | 0 | rc1 tests: pass 87 fail 0 |
| rc1_final_test | PASS | 26 | 0 | rc1 final tests: pass 26 fail 0 |
| rc2_dev_test | PASS | 3 | 0 | rc2-dev tests: pass 3 fail 0 |
| td21_test | PASS | 34 | 0 | td21 tests: pass 34 fail 0 |
| td22_test | PASS | 12 | 0 | td22 tests: pass 12 fail 0 |
| ramp_test | PASS | 18 | 0 | ramp tests: pass 18 fail 0 (open, not counted: 0) |
| load_guard_test | PASS | 11 | 0 | load guard tests: pass 11 fail 0 |
| activity_test | PASS | 140 | 0 | activity tests: pass 140 fail 0 |
| recipe_gate | PASS | 344 | 0 | recipe gate: pass 344 fail 0 (warnings beyond missing source field: 15) |
| soak_test | PASS | 3 | 0 | soak test: 3 scenarios, 910 simulated days, 331 adaptations applied, 35 undone — pass 3 fail 0 |
| e2e | PASS | 117 | 0 | E2E: pass 117 fail 0 |
| e2e_menu_structure | PASS | 42 | 0 | menu structure tests: pass 42 fail 0 |
| e2e_stageA | PASS | 87 | 0 | stage A e2e: pass 87 fail 0 |
| e2e_stageB | PASS | 76 | 0 | stage B e2e: pass 76 fail 0 |
| e2e_stageC | PASS | 34 | 0 | stage C e2e: pass 34 fail 0 |
| e2e_stageD | PASS | 61 | 0 | stage D e2e: pass 61 fail 0 |
| e2e_stageE | PASS | 11 | 0 | stage E e2e: pass 11 fail 0 |
| e2e_stageF | PASS | 17 | 0 | stage F e2e: pass 17 fail 0 |
| e2e_stageG | PASS | 26 | 0 | stage G e2e: pass 26 fail 0 |
| e2e_stageH1 | PASS | 40 | 0 | stage H1 e2e: pass 40 fail 0 |
| e2e_rc1 | PASS | 36 | 0 | rc1 e2e: pass 36 fail 0 |
| e2e_rc1_layout | PASS | 17 | 0 | rc1 layout e2e: pass 17 fail 0 |
| e2e_beta | PASS | 35 | 0 | beta e2e: pass 35 fail 0 |
| e2e_meal_journal | PASS | 34 | 0 | meal journal e2e: pass 34 fail 0 |
| e2e_now | PASS | 17 | 0 | now e2e: pass 17 fail 0 |
| e2e_shell | PASS | 85 | 0 | shell e2e: pass 85 fail 0 |
| e2e_savefail | PASS | 8 | 0 | save-fail e2e: pass 8 fail 0 |
| e2e_activity | PASS | 23 | 0 | activity e2e: pass 23 fail 0 |
| e2e_grocery | PASS | 13 | 0 | grocery e2e: pass 13 fail 0 |
| e2e_fridge | PASS | 12 | 0 | fridge e2e: pass 12 fail 0 |
| e2e_planb_feedback | PASS | 16 | 0 | planb/feedback e2e: pass 16 fail 0 |
| e2e_i18n | PASS | 8 | 0 | i18n e2e: pass 8 fail 0 |
| e2e_m8 | PASS | 54 | 0 | m8 e2e: pass 54 fail 0 |
| e2e_m9_identity | PASS | 81 | 0 | m9 identity e2e: pass 81 fail 0 |
| e2e_m10_ux | PASS | 143 | 0 | m10 ux e2e: pass 143 fail 0 |
| e2e_m104_fixes | PASS | 104 | 0 | m104 tests: pass 104 fail 0 |
| e2e_m11_run | PASS | 43 | 0 | m11 run tests: pass 43 fail 0 |
| e2e_m11_coach | PASS | 79 | 0 | m11 coach tests: pass 79 fail 0 |
| e2e_m11_meals | PASS | 31 | 0 | m11 meals tests: pass 31 fail 0 |
| e2e_m11_sync | PASS | 20 | 0 | m11 sync tests: pass 20 fail 0 |
| e2e_m12_gate | PASS | 30 | 0 | m12 gate tests: pass 30 fail 0 |
| e2e_food_global | PASS | 29 | 0 | food global tests: pass 29 fail 0 |
| e2e_content | PASS | 9 | 0 | content e2e: pass 9 fail 0 |
| e2e_builder | PASS | 49 | 0 | builder e2e: pass 49 fail 0 |
| e2e_run_state | PASS | 31 | 0 | run state e2e: pass 31 fail 0 |
| e2e_android_bridge | PASS | 10 | 0 | android bridge e2e: pass 10 fail 0 |
| artcheck | PASS | 2 | 0 | artcheck :: 2 PASS / 0 FAIL |
| e2e_sw_shell | PASS | 9 | 0 | sw shell e2e: pass 9 fail 0 |
| rls_test | PASS | 61 | 0 | rls tests: pass 61 fail 0 |
| rls_cms_test | PASS | 99 | 0 | cms rls tests: pass 99 fail 0 |
| rollback_test | PASS | 28 | 0 | rollback test: pass 28 fail 0 |
| e2e_account | PASS | 113 | 0 | account e2e: pass 113 fail 0 |
| e2e_admin | PASS | 56 | 0 | admin e2e: pass 56 fail 0 |
| e2e_app_control | PASS | 62 | 0 | app control e2e: pass 62 fail 0 |
| location_scan | PASS | 7 | 0 | location scan: pass 7 fail 0 |

Manual tests still required: a physical iPhone (Safari) and an Android device; the live Supabase project after the owner applies the CMS migration.

---

## Supplement (from the actual outputs of this session)

**Code commit:** `d246052`. The evidence above was generated at HEAD `66a773a`; `git diff --stat d246052 66a773a -- src tools supabase native` is empty (HEAD adds documentation only). The runner log was produced on `d246052`, build `74bdd9483f`.

**First load** (network bytes, `e2e_stageA` → `perf.firstLoadBytes`): **787,720 B**; budget < 820,000 B unchanged.

### WebKit (Playwright WebKit with an iPhone 13 profile, **not** a device): 9 suites, 400 checks, 0 failures
| Suite | Result |
|---|---|
| e2e_run_state | PASS 31 / fail 0 |
| e2e_m11_run | PASS 43 / fail 0 |
| e2e_builder | PASS 49 / fail 0 |
| e2e_menu_structure | PASS 42 / fail 0 |
| e2e_m11_meals | PASS 31 / fail 0 |
| e2e_content | PASS 9 / fail 0 |
| e2e_food_global | PASS 29 / fail 0 |
| e2e_m104_fixes | PASS 104 / fail 0 |
| e2e_app_control | PASS 62 / fail 0 |

`e2e_stageB` was also run in that batch, but it has no WebKit support (it ran on Chromium, 76/76), so it is **not** counted as WebKit.

### Server permissions for the admin accounts tab (local PostgreSQL 16 + RLS, not the hosted project)
- `rls_cms_test` 99/99:
  - anonymous / user / editor / reviewer are refused;
  - admin counts match the tables;
  - no e-mail or user id in the result;
  - rollback removes the function and keeps the data;
  - the migration re-applies cleanly.
- `e2e_admin` 56/56: user and editor get **403** from the API.
- The first `e2e_admin` attempt failed 2 checks because the local API emulator did not expose the new function (404). That is an emulator gap, not a product defect. The function was added to the emulator's list, as PostgREST exposes every function with EXECUTE; no assertion was changed.

### Reproducibility
`d246052` was checked out into a clean worktree and `tools/build.js` was run there. Result: build `74bdd9483f`, and `diff -rq` against `dist/pwa` shows **identical files**.

### Packages
Location (this session's workspace): `/tmp/claude-0/-home-claude/4b523f9c-d418-5f33-b589-8c73a6e27351/scratchpad/release-74bdd9483f/`

| File | Format | Bytes | SHA-256 |
|---|---|---|---|
| `sofitgo-devtest-74bdd9483f-d246052.zip` | Web/PWA build, local only (empty accounts config) + serve_beta.py + guides | 3143913 | `1d5c31c7c446392cbee1703e9aae5053d8b2ed804bcf3ad0acc71ebd037328a1` |
| `sofitgo-beta-74bdd9483f-d246052.apk` | Android installable APK (WebView over the same build; local only) | 4089444 | `53f8327d1e8cf172a8eaf25b80e6523774ef7c3940b21d9dc4642dc64cf9d22d` |
| `sofitgo-beta-74bdd9483f-d246052.zip` | Web/PWA build with the accounts config (publishable key only), for a deploy after approval | 3127005 | `e445894dfda9cb4a835d5e17a7f94455719c16c4dc1507907cfad3e86a9b72c2` |
| `sofitgo-source-d246052.zip` | source (git archive of d246052) | 4101597 | `f4379fcdef28f7e3543416fb4a15b9ae6cc59200f5f49e89347ed2d491f3c0b9` |

**Checks run on the packages:**
- `sha256sum -c`: all OK.
- `unzip -t`: all OK.
- `sw.js` build in both web ZIPs: `fit30-74bdd9483f`.
- devtest config: `supabaseUrl: ''`.
- Secret scan:
  - no `sb_secret_`, private key, service-role token, keystore or password file in any package or APK;
  - the source ZIP has 10 pattern hits, all guard code, documentation or the fake test value `sb_secret_0123456789abcdef`;
  - the live publishable key (public by design) is present only in `sofitgo-beta-…zip`;
  - the signing password appears in neither the APK nor the build log.
- Run test of the devtest package: extracted into an empty folder, with its own `serve_beta.py` started. Workout started, set done, reload → same step, in Chromium and WebKit. Offline reload: Chromium OK; WebKit under Playwright: tool internal error, so **not verified** (device test T10).

### APK
`apksigner verify --print-certs`:
- verified (APK Signature Scheme v2); 1 signer; `CN=SoFitGo Beta Test, O=SoFitGo`;
- certificate SHA-256 `259273c37be7735aeb38ad669db57fa0b7c79096fef65fb66e7413da86a44fd5` (matches `docs/ANDROID_SIGNING_KEY.md`).

`aapt2 dump badging`:
- `com.sofitgo.beta.test`, versionCode 77, versionName `0.6.0-beta+74bdd9483f`;
- targetSdk 35, minSdk 24;
- permissions: INTERNET, VIBRATE, ACCESS_COARSE_LOCATION.

Bundled `assets/www` = the exact file list of `dist/pwa`, with `sw.js` build `74bdd9483f` and an empty accounts config.

**Not installed on any device or emulator.** This container has no `/dev/kvm`, so the Android emulator cannot run.

### Not verified (honest list)
- Any physical iPhone or Android device: install, screen lock, OS suspension, restart, wake lock, sound/vibration, home-screen install.
- The hosted Supabase project: no live migration, no live CMS, no live accounts tab.
- WebKit offline reload under Playwright.

Production, Netlify, live Supabase and billing were **not touched**.
