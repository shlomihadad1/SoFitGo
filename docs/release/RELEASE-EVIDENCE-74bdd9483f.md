# Release Evidence: build 74bdd9483f

- Commit: `ae76c1678f98ee78e504b2b3b4fcfec285a35b06` (fix/default-cuisine); working tree clean
- Generated: 2026-10-25T13:08:26.820Z from `run-503da39.log` (the actual runner output)
- Environment: local container, Node v22.22.0. Browsers are Playwright Chromium/WebKit **emulation**, not physical devices. The backend is a local PostgreSQL 16 emulator, not the hosted project.
- Command: `sh tools/run_all.sh`
- index.html size: 777433 B (the first-load budget, including network, is asserted by e2e_stageA)
- ZIP: not given

| Result | Suites |
|---|---|
| PASS | 71 |
| FAIL (assertions) | 0 |
| CRASH (runner crash) | 0 |
| TIMEOUT | 0 |
| NOT_RUN | 0 |

Checks counted from the suites' own summaries: 27071 passed, 0 failed.

| Suite | Result | Pass | Fail | Runner line |
|---|---|---|---|---|
| build_check | PASS | 188 | 0 | build checks: pass 188 fail 0 |
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
| migration_audit_test | PASS | 35 | 0 | migration audit: pass 35 fail 0 |
| e2e_account | PASS | 113 | 0 | account e2e: pass 113 fail 0 |
| e2e_admin | PASS | 56 | 0 | admin e2e: pass 56 fail 0 |
| e2e_app_control | PASS | 62 | 0 | app control e2e: pass 62 fail 0 |
| location_scan | PASS | 7 | 0 | location scan: pass 7 fail 0 |

Manual tests still required: a physical iPhone (Safari) and an Android device; the live Supabase project after the owner applies the CMS migration.

---

## Supplement (from the actual outputs of this session)

**Runner log:**
- Produced on commit `503da39`, build `74bdd9483f` (first line of the log).
- The evidence header shows HEAD at generation time.

**Commits after `503da39`:**
- `supabase/activation/*`: the one-paste SQL, i.e. the three migrations and rollbacks concatenated **unchanged** inside one transaction;
- `tools/migration_audit_test.js` (+9 checks);
- documentation.

**App code** (`src`) is unchanged since `d246052`.

**After these commits:**
- `migration_audit_test` 44/44;
- `rls_test` 61/61, `rls_cms_test` 99/99, `rollback_test` 28/28;
- `activate_admin.sql`:
  - gives the same schema as the three migrations one by one;
  - running it twice is harmless;
  - a failure inside it changes nothing;
- `undo_admin.sql` restores the exact baseline;
- `make_owner.sql` adds exactly one owner, and nothing for an unknown e-mail.

**Earlier, on the same build `74bdd9483f` (`d246052`):**
- WebKit: 9 suites, 400 checks, 0 failures.

### Final packages (built from a clean worktree of `4e23429`)
| File | Format | SHA-256 |
|---|---|---|
| `sofitgo-activation-4e23429.zip` | | `bf9ff5dd4520948ed73188990c6ba740e4ebb320ac69e6c0fcb6293ea028b63f` |
| `sofitgo-deploy-74bdd9483f-4e23429.zip` | | `ed238aa5ec29f4eae195aecd235fcb2f602eb3cc029ce56621e4f1552fd19347` |
| `sofitgo-beta-74bdd9483f-d246052.apk` | | `53f8327d1e8cf172a8eaf25b80e6523774ef7c3940b21d9dc4642dc64cf9d22d` |

- `sofitgo-deploy-…zip`:
  - Netlify site folder: the PWA, plus the accounts config (publishable key only);
  - no README, local server or guides;
  - every service-worker precache file is present;
  - secret scan clean;
  - files identical to the tested `dist/pwa`, except the config and the removed README;
  - ran from an empty folder: workout, reload, offline reload OK (Chromium).
- `sofitgo-activation-…zip`: `activate_admin.sql`, `make_owner.sql` and `undo_admin.sql` (byte-identical to the repo), plus `ACTIVATE.md`.
- `…apk`:
  - built from `d246052`, the same app code;
  - signature v2 verified;
  - certificate SHA-256 `259273c3…44fd5`;
  - **not installed on any device or emulator** (no KVM here).

### Not done or not verified
- **Live Supabase:**
  - migrations not applied;
  - no owner created;
  - auth URLs not checked;
  - no backup taken (no access).
- **Netlify:** nothing deployed. The site currently serves the local-only test package of `74bdd9483f`.
- **Devices:** no physical iPhone or Android test.
- **Signing key backup:** waiting for the owner's age public key. The key is untouched.

Production, Netlify, live Supabase and billing were **not touched**.
