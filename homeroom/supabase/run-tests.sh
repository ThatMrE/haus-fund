#!/usr/bin/env bash
#
# Run schema.sql and test.sql against a scratch Postgres, to check the
# access rules before they go anywhere near a real project.
#
# The rules in schema.sql are the only thing standing between a member
# and someone else's private notes, so they are worth testing offline.
# local-stub.sql supplies the pieces Supabase would otherwise provide:
# the auth schema, auth.uid(), and the anon/authenticated roles with the
# same default grants Supabase applies.
#
# Usage:  ./run-tests.sh                 (spins up its own cluster)
#         PGURL=postgres://... ./run-tests.sh   (uses an existing one)
set -euo pipefail
cd "$(dirname "$0")"

if [ -n "${PGURL:-}" ]; then
  psql "$PGURL" -q -v ON_ERROR_STOP=1 -f local-stub.sql
  psql "$PGURL" -q -v ON_ERROR_STOP=1 -f schema.sql
  psql "$PGURL" -q -f test.sql
  exit 0
fi

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
[ -x "$PGBIN/initdb" ] || { echo "No local Postgres found. Set PGBIN, or PGURL to an existing database."; exit 1; }

# initdb refuses to run as root. Hand the whole script to an unprivileged
# user rather than failing halfway through.
if [ "$(id -u)" = 0 ]; then
  for candidate in postgres nobody; do
    if id "$candidate" >/dev/null 2>&1; then
      exec su "$candidate" -s /bin/bash -c "PGBIN='$PGBIN' $(pwd)/run-tests.sh"
    fi
  done
  echo "Run this as a normal user, not root - initdb will not start a cluster owned by root."
  exit 1
fi

DATA=$(mktemp -d) && SOCK=$(mktemp -d)
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA" "$SOCK"' EXIT

"$PGBIN/initdb" -D "$DATA" -A trust -U postgres >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-k $SOCK -p 5433 -c listen_addresses=" -l "$DATA/log" start >/dev/null
export PGHOST="$SOCK" PGPORT=5433 PGUSER=postgres

"$PGBIN/psql" -q -c 'create database homeroom' >/dev/null
"$PGBIN/psql" -d homeroom -q -v ON_ERROR_STOP=1 -f local-stub.sql
"$PGBIN/psql" -d homeroom -q -v ON_ERROR_STOP=1 -f schema.sql
"$PGBIN/psql" -d homeroom -q -f test.sql
