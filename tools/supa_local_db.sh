#!/bin/sh
# Creates a fresh local database for supa_local.js: Supabase shim + every migration. LOCAL TEST ONLY.
set -e
cd "$(dirname "$0")/.."
DB=${SUPA_DB:-sofitgo_local}; H=${PGHOST:-/tmp}; P=${PGPORT:-54329}
psql -h $H -p $P -U postgres -qX -c "drop database if exists $DB" -c "create database $DB" >/dev/null
psql -h $H -p $P -U postgres -d $DB -qX -v ON_ERROR_STOP=1 -f supabase/test/local_supabase_shim.sql >/dev/null 2>&1
for f in supabase/migrations/*.sql; do psql -h $H -p $P -U postgres -d $DB -qX -v ON_ERROR_STOP=1 -f "$f" >/dev/null 2>&1; done
echo "local db $DB ready"
