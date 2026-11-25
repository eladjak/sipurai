#!/usr/bin/env bash
# Run in the postgres image, with its own PID namespace and a read-only repository.
set -euo pipefail
[[ $$ -eq 1 ]] || { echo 'Run as PID 1 in an isolated container.' >&2; exit 2; }
repo=$(cd "$(dirname "$0")/../.." && pwd)
work=$(mktemp -d /tmp/sipurai-editor-db-XXXXXXXX)
chown postgres "$work"
runuser -u postgres -- initdb -D "$work/db" --no-locale --encoding=UTF8 --auth=trust --no-sync >/dev/null
runuser -u postgres -- pg_ctl -D "$work/db" -o "-k $work -c listen_addresses=''" -l "$work/server.log" -w start >/dev/null
trap 'runuser -u postgres -- pg_ctl -D "$work/db" -m fast -w stop >/dev/null 2>&1' EXIT
psql_test() { psql -X -h "$work" -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_test -f "$repo/tests/generation-private/bootstrap.sql" -f "$repo/tests/editor-page-text/sql-test.sql" >/dev/null
echo 'editor page RPC: Clerk and row ownership, security invoker and grants, null/empty and long Hebrew verified'
psql_test -At -c "SET ROLE authenticated; SET request.jwt.claims TO '{\"sub\":\"owner\"}'; BEGIN; SELECT count(*) FROM public.sipurai_save_page_text('11111111-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','owner','base','winner'); SELECT pg_sleep(2); COMMIT;" >"$work/editor-first.log" 2>&1 &
editor_pid=$!
for _ in {1..50}; do
  first_has_lock=$(psql_test -At -c "SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE '%sipurai_save_page_text%'")
  [[ "$first_has_lock" -gt 0 ]] && break
  sleep 0.1
done
[[ "$first_has_lock" -gt 0 ]] || { echo 'first editor transaction did not acquire its row lock'; exit 1; }
psql_test -At -c "SET ROLE authenticated; SET request.jwt.claims TO '{\"sub\":\"owner\"}'; SELECT count(*) FROM public.sipurai_save_page_text('11111111-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','owner','base','runner-up');" >"$work/editor-second.log" 2>&1 &
editor_second_pid=$!
wait "$editor_pid"
wait "$editor_second_pid"
grep -qx '1' "$work/editor-first.log"
grep -qx '0' "$work/editor-second.log"
echo 'concurrent editor transaction: one writer succeeds and one refreshes its conflict'
