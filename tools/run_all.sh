#!/bin/sh
# Runs every suite against the dev copy and prints one line per suite. Logs: dist/reports/logs/<suite>.log
cd "$(dirname "$0")/.." || exit 1
export NODE_PATH=/opt/npm-tools/node_modules
L=dist/reports/logs; mkdir -p $L
node tools/build.js > $L/build.log 2>&1 || { echo "BUILD FAILED"; exit 1; }
tail -1 $L/build.log
for t in build_check content_test stageA_test stageB_test stageC_test stageD_test stageE_test stageF_test stageG_test stageH1_test rc1_test rc1_final_test rc2_dev_test td21_test td22_test ramp_test load_guard_test activity_test recipe_gate soak_test; do
  [ -f tools/$t.js ] || continue
  node tools/$t.js > $L/$t.log 2>&1; echo "$t exit=$? :: $(tail -1 $L/$t.log)"; done
for t in e2e e2e_stageA e2e_stageB e2e_stageC e2e_stageD e2e_stageE e2e_stageF e2e_stageG e2e_stageH1 e2e_rc1 e2e_rc1_layout e2e_beta e2e_meal_journal e2e_now e2e_shell e2e_savefail e2e_activity e2e_grocery e2e_fridge e2e_planb_feedback e2e_i18n e2e_m8 e2e_m9_identity e2e_m10_ux e2e_m104_fixes e2e_m11_run e2e_m11_coach e2e_m11_meals e2e_m11_sync e2e_m12_gate; do
  [ -f tools/$t.js ] || continue
  timeout 600 node tools/$t.js > $L/$t.log 2>&1; echo "$t exit=$? :: $(tail -1 $L/$t.log)"; done
node tools/artcheck.js "$PWD/dist/artifact/fit30.html" > $L/artcheck.log 2>&1; echo "artcheck :: $(grep -c PASS $L/artcheck.log) PASS / $(grep -c FAIL $L/artcheck.log) FAIL"
# RC5: service-worker shell test runs its own server (no port 8096 needed)
timeout 600 node tools/e2e_sw_shell.js > $L/e2e_sw_shell.log 2>&1; echo "e2e_sw_shell exit=$? :: $(tail -1 $L/e2e_sw_shell.log)"
# M10: backend (real local PostgreSQL 16 + Supabase shim) and account/sync e2e against the local Supabase emulator
sh tools/pg_local.sh > $L/pg_local.log 2>&1
for t in rls_test rollback_test; do PGHOST=/tmp PGPORT=54329 node tools/$t.js > $L/$t.log 2>&1; echo "$t exit=$? :: $(tail -1 $L/$t.log)"; done
PGHOST=/tmp PGPORT=54329 timeout 900 node tools/e2e_account.js > $L/e2e_account.log 2>&1; echo "e2e_account exit=$? :: $(tail -1 $L/e2e_account.log)"
node tools/location_scan.js --self-test > $L/location_scan.log 2>&1; echo "location_scan exit=$? :: $(tail -1 $L/location_scan.log)"
