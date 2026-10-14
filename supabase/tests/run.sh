#!/usr/bin/env bash
# Runs the pgTAP database tests (L4) against the database in SUPABASE_DB_URL.
# Each test file runs in a transaction that is rolled back, so no data is left behind.
set -euo pipefail

# Locally, the connection string comes from frontend/.env.local; in CI, from a secret.
env_file="$(dirname "$0")/../../frontend/.env.local"
if [[ -z "${SUPABASE_DB_URL:-}" && -f "$env_file" ]]; then
  SUPABASE_DB_URL="$(grep '^SUPABASE_DB_URL=' "$env_file" | cut -d= -f2-)"
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL is not set" >&2
  exit 1
fi

tests_dir="$(dirname "$0")/database"

for test_file in "$tests_dir"/*.test.sql; do
  echo "# $(basename "$test_file")"
  psql "$SUPABASE_DB_URL" --quiet --no-psqlrc --tuples-only -v ON_ERROR_STOP=1 --file "$test_file"
done
