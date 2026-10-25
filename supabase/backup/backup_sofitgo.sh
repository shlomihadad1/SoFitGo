#!/bin/bash
# SoFitGo · READ-ONLY backup of the live Supabase database to this Mac (no Docker needed).
# It only runs pg_dump and SELECT count(*) — nothing in the project is changed.
# Needs the PostgreSQL client tools:  brew install libpq
# Usage:  bash backup_sofitgo.sh
# You will be asked for (1) the Session pooler connection string from Supabase → Connect, and (2) the database password
# (typed hidden; not shown, not saved, not written to any file or to the shell history).
set -euo pipefail
pick() { command -v "$1" 2>/dev/null || { for d in /opt/homebrew/opt/libpq/bin /usr/local/opt/libpq/bin; do [ -x "$d/$1" ] && { echo "$d/$1"; return; }; done; echo ""; }; }
PG_DUMP=$(pick pg_dump); PG_RESTORE=$(pick pg_restore); PSQL=$(pick psql)
[ -n "$PG_DUMP" ] && [ -n "$PG_RESTORE" ] && [ -n "$PSQL" ] || { echo "PostgreSQL client tools not found. Run:  brew install libpq   and try again."; exit 1; }
echo "pg_dump: $("$PG_DUMP" --version)"
echo
echo "Paste the Session pooler connection string (Supabase → Connect → Session pooler)."
echo "It looks like  postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres"
read -r -p "> " URI
URI=$(printf '%s' "$URI" | tr -d '[:space:]')
case "$URI" in postgres://*|postgresql://*) ;; *) echo "That is not a postgresql:// connection string."; exit 1;; esac
# remove any password part from the string; the password is asked separately (hidden)
URI_NOPW=$(printf '%s' "$URI" | sed -E 's#^(postgres(ql)?://[^:@/]+):[^@]*@#\1@#')
read -r -s -p "Database password (hidden): " PGPASSWORD; echo; export PGPASSWORD
trap 'unset PGPASSWORD' EXIT
OUT="$HOME/Documents/SoFitGo-Backup/$(date +%Y-%m-%d_%H%M)"; mkdir -p "$OUT"; chmod 700 "$OUT"
echo "Backing up to $OUT …"
"$PG_DUMP" "$URI_NOPW" --format=custom --no-owner --no-privileges --schema=public --file="$OUT/sofitgo-public.dump"
"$PG_DUMP" "$URI_NOPW" --format=custom --data-only --table=auth.users --table=auth.identities --file="$OUT/sofitgo-auth-users.dump"
chmod 600 "$OUT"/*.dump
# verification: rows in the live tables (read-only) vs rows inside the backup files
live() { "$PSQL" "$URI_NOPW" -X -At -c "select count(*) from $1"; }
inbk() { "$PG_RESTORE" --data-only --table="$2" -f - "$OUT/$1" | sed -n '/^COPY /,/^\\\./p' | grep -vc '^COPY \|^\\\.' || true; }
ok=1; printf '\n%-22s %8s %8s\n' table live backup
for t in profiles user_state bug_reports app_config; do a=$(live "public.$t"); b=$(inbk sofitgo-public.dump "$t"); printf '%-22s %8s %8s %s\n' "public.$t" "$a" "$b" "$([ "$a" = "$b" ] && echo OK || { ok=0; echo MISMATCH; })"; done
a=$(live auth.users); b=$("$PG_RESTORE" --data-only -t users -f - "$OUT/sofitgo-auth-users.dump" | sed -n '/^COPY auth.users/,/^\\\./p' | grep -vc '^COPY \|^\\\.' || true)
printf '%-22s %8s %8s %s\n' auth.users "$a" "$b" "$([ "$a" = "$b" ] && echo OK || { ok=0; echo MISMATCH; })"
(cd "$OUT" && shasum -a 256 *.dump > SHA256SUMS.txt)
echo
if [ $ok = 1 ]; then echo "BACKUP OK — every table matches. Files: $OUT"; else echo "BACKUP INCOMPLETE — a count does not match. Do NOT activate; send me the table above (no password)."; exit 2; fi
echo "Keep this folder safe: it contains users' e-mails and personal data (encrypted disk / not e-mail)."
