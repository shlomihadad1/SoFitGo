#!/bin/sh
# LOCAL TEST ONLY: makes sure a throwaway PostgreSQL 16 cluster is running on port 54329 (socket /tmp) for rls_test.js and
# e2e_account.js. Data lives in /var/tmp/sofitgo-pg and holds only generated test users.
BIN=/usr/lib/postgresql/16/bin; D=/var/tmp/sofitgo-pg
pg_isready -h /tmp -p 54329 >/dev/null 2>&1 && { echo "local postgres already running"; exit 0; }
[ -x $BIN/postgres ] || { echo "PostgreSQL 16 server binaries not found ($BIN)"; exit 1; }
mkdir -p $D && chown postgres $D
[ -f $D/data/PG_VERSION ] || runuser -u postgres -- $BIN/initdb -D $D/data -A trust -U postgres >/dev/null
runuser -u postgres -- $BIN/pg_ctl -D $D/data -o "-p 54329 -k /tmp" -l $D/log.txt start >/dev/null && sleep 2
pg_isready -h /tmp -p 54329 && echo "local postgres started"
