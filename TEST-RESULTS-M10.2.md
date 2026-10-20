# TEST RESULTS — M10.2 · build `bb71326a75` · commit `bcbfd32`

Command: `sh tools/run_all.sh` on the frozen source. Environment: Chromium 1.56 with iPhone/iPad emulation, local PostgreSQL 16 and a local Supabase emulator. **Not Safari, not a real device, not the live Supabase.** Full log: `TEST-LOG-M10.2-bb71326a75.txt`.

**50 suites — 0 failures.**

| Suite | Result |
|---|---|
| build_check | build checks: pass 146 fail 0 |
| content_test | content tests: pass 6769 fail 0 |
stageA_test | stage A tests: pass 4163 fail 0 |
stageB_test | stage B tests: pass 328 fail 0 |
stageC_test | stage C tests: pass 861 fail 0 |
stageD_test | stage D tests: pass 49 fail 0 |
stageE_test | stage E tests: pass 901 fail 0 |
stageF_test | stage F tests: pass 48 fail 0 |
stageG_test | stage G tests: pass 47 fail 0 |
stageH1_test | stage H1 tests: pass 165 fail 0 |
| rc1_test | rc1 tests: pass 86 fail 0 |
| rc1_final_test | rc1 final tests: pass 26 fail 0 |
| rc2_dev_test | rc2-dev tests: pass 3 fail 0 |
| td21_test | td21 tests: pass 34 fail 0 |
| td22_test | td22 tests: pass 12 fail 0 |
| ramp_test | ramp tests: pass 18 fail 0 (open, not counted: 0) |
| load_guard_test | load guard tests: pass 11 fail 0 |
| activity_test | activity tests: pass 140 fail 0 |
| recipe_gate | recipe gate: pass 144 fail 0 (warnings beyond missing source field: 21) |
| soak_test | soak test: 3 scenarios, 910 simulated days, 330 adaptations applied, 35 undone — pass 3 fail 0 |
| e2e | E2E: pass 117 fail 0 |
e2e_stageA | stage A e2e: pass 87 fail 0 |
e2e_stageB | stage B e2e: pass 75 fail 0 |
e2e_stageC | stage C e2e: pass 34 fail 0 |
e2e_stageD | stage D e2e: pass 61 fail 0 |
e2e_stageE | stage E e2e: pass 11 fail 0 |
e2e_stageF | stage F e2e: pass 17 fail 0 |
e2e_stageG | stage G e2e: pass 26 fail 0 |
e2e_stageH1 | stage H1 e2e: pass 40 fail 0 |
| e2e_rc1 | rc1 e2e: pass 36 fail 0 |
| e2e_rc1_layout | rc1 layout e2e: pass 17 fail 0 |
| e2e_beta | beta e2e: pass 35 fail 0 |
| e2e_meal_journal | meal journal e2e: pass 33 fail 0 |
| e2e_now | now e2e: pass 18 fail 0 |
| e2e_shell | shell e2e: pass 85 fail 0 |
| e2e_savefail | save-fail e2e: pass 8 fail 0 |
| e2e_activity | activity e2e: pass 23 fail 0 |
| e2e_grocery | grocery e2e: pass 13 fail 0 |
| e2e_fridge | fridge e2e: pass 12 fail 0 |
| e2e_planb_feedback | planb/feedback e2e: pass 16 fail 0 |
| e2e_i18n | i18n e2e: pass 8 fail 0 |
| e2e_m8 | m8 e2e: pass 53 fail 0 |
| e2e_m9_identity | m9 identity e2e: pass 81 fail 0 |
| e2e_m10_ux | m10 ux e2e: pass 138 fail 0 |
artcheck :: 2 PASS / 0 FAIL |  |
| e2e_sw_shell | sw shell e2e: pass 9 fail 0 |
| rls_test | rls tests: pass 55 fail 0 |
| rollback_test | rollback test: pass 28 fail 0 |
| e2e_account | account e2e: pass 104 fail 0 |
| location_scan | location scan: pass 7 fail 0 |

## Against the real Supabase project
- `live_check.js` part 1 (anonymous): 7/7.
- A real sign-up: HTTP 200, `confirmation_sent_at`.
- The live app in a browser: the connection loads, `beta_open` is read, a wrong login is rejected in Hebrew.
- **Not run:** `live_check.js` part 2 and `live_app_check.js`. They need two confirmed test users; both scripts were validated against the emulator (40/40, 19/19).
