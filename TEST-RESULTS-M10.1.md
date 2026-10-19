# TEST RESULTS — M10.1 Beta · build `a3701822bf` · 2026-10-20

Environment: Linux cloud, Playwright Chromium 1.56 with iPhone 13 emulation (also 320, 390 and 820 px). **NOT Safari, NOT a real device.** Local PostgreSQL 16.

## Ran on the final build — 30 suites, 0 failures
| Suite | Result |
|---|---|
| build_check (secret scan, standard build has no keys) | 142/142 |
| rc1_test (incl. 12 tutorials re-recorded from this build) | 86/86 |
| rc1_final_test | 26/26 |
| content_test | 6,769/6,769 |
| stageA_test | 4,163/4,163 |
| stageB_test | 328/328 |
| stageC_test | 861/861 |
| stageE_test | 901/901 |
| rls_test (real PostgreSQL RLS) | 55/55 |
| rollback_test | 28/28 |
| e2e (core flows) | 117/117 |
| e2e_stageA (first load within 712,000 B) | 86/86 |
| e2e_shell (header/nav, safe areas; Home checked via logo) | 85/85 |
| e2e_sw_shell (offline) | 9/9 |
| e2e_now | 18/18 |
| e2e_m9_identity | 81/81 |
| **e2e_m10_ux** (keyboard, nutrition-only, meal card, Home header, water L and target, Manali removed, no geolocation, field alignment at 3 widths, onboarding without flicker or data loss, full onboarding and reload) | **87/87** |
| e2e_i18n | 8/8 |
| e2e_meal_journal (incl. duplicate-recipe guard) | 33/33 |
| e2e_stageD | 61/61 |
| e2e_beta | 35/35 |
| e2e_savefail | 8/8 |
| **e2e_account** (first-launch welcome, honest "not switched on" state, sofitgo-config.js switch incl. rejected secret key, sign-up with confirmation, login, logout wipe, session restore, onboarding redirect, sync, migration, A/B isolation via API, reset link, deletion) against the LOCAL emulator | **90/90** |
| e2e_m8 | 53/53 |
| e2e_stageB | 75/75 |
| e2e_stageH1 | 40/40 |

## Not run on this build
- The remaining suites of `run_all.sh`: e2e_stageC/E/F/G, e2e_rc1*, e2e_activity, e2e_grocery, e2e_fridge, e2e_planb_feedback, stageD/F/G/H1, td21/22, ramp, load_guard, activity, recipe_gate, soak and others. They passed on M9 and/or on e11ee266ea.
- **Nothing against the live Supabase project.** The migration has not been applied, and the publishable key is not set.
- **Safari and real iPhone/iPad.**
