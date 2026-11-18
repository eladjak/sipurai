#!/usr/bin/env bash
set -euo pipefail
# Direct invocation under unshare makes this script PID 1 in its own PID namespace.
# Refuse to start or stop any server if that condition is not met.
if [[ $$ -ne 1 ]]; then
  echo 'Run directly: unshare --fork --pid --mount-proc ./tests/generation-private/run-local.sh' >&2
  exit 2
fi
repo=$(cd "$(dirname "$0")/../.." && pwd)
pg_config_bin=${PG_CONFIG:-$(command -v pg_config || true)}
pg_bin=${PG_BINDIR:-$(${pg_config_bin:?Set PG_BINDIR or PG_CONFIG} --bindir)}
pg_share=${PG_SHAREDIR:-$(${pg_config_bin:?Set PG_SHAREDIR or PG_CONFIG} --sharedir)}
[[ -x "$pg_bin/initdb" && -x "$pg_bin/pg_ctl" && -f "$pg_share/postgres.bki" ]] || {
  echo 'A matching PostgreSQL server PG_BINDIR and PG_SHAREDIR are required.' >&2; exit 2;
}
command -v psql >/dev/null
command -v createdb >/dev/null
unset PGHOST PGPORT PGDATABASE PGUSER PGOPTIONS PGSERVICE
work=$(mktemp -d "${TMPDIR:-/tmp}/spx-pg-XXXXXXXX")
chmod 755 "$work"
# Copy so the ordinary server user can traverse paths even if sources are under /root.
major=$("$pg_bin/postgres" --version | sed -E 's/.* ([0-9]+).*/\1/')
[[ "$major" =~ ^[0-9]+$ ]] || { echo 'Cannot determine PostgreSQL major version.' >&2; exit 2; }
mkdir -p "$work/usr/lib/postgresql/$major" "$work/usr/share/postgresql/$major" "$work/data" "$work/socket"
cp -a "$(dirname "$pg_bin")/." "$work/usr/lib/postgresql/$major/"
cp -a "$pg_share/." "$work/usr/share/postgresql/$major/"
chmod -R a+rX "$work/usr"
bin="$work/usr/lib/postgresql/$major/bin"
share="$work/usr/share/postgresql/$major"
if [[ $(id -u) -eq 0 ]]; then
  id nobody >/dev/null
  chown nobody "${work}/data" "${work}/socket"
  pguser=nobody
  run_pg() { runuser -u nobody -- "$@"; }
else
  pguser=$(id -un)
  run_pg() { "$@"; }
fi
started=0
cleanup() {
  if [[ $started -eq 1 ]]; then
    # pg_ctl reads only our freshly-created data directory, within this PID namespace.
    run_pg "$bin/pg_ctl" -D "$work/data" -m fast -w stop >/dev/null 2>&1 || true
  fi
  rm -rf -- "$work"
}
trap cleanup EXIT
run_pg "$bin/initdb" -D "$work/data" -L "$share" --no-locale --encoding=UTF8 --auth=trust --no-sync >/dev/null
run_pg "$bin/pg_ctl" -D "$work/data" -o "-k $work/socket -c listen_addresses=''" -l "$work/data/server.log" -w start >/dev/null
started=1
psql_test() { psql -X -h "$work/socket" -U "$pguser" -d "$1" -v ON_ERROR_STOP=1 "${@:2}"; }
wait_for_transaction() {
  local marker=$1 count
  for _ in {1..50}; do
    count=$(psql_test postgres -At -c "SELECT count(*) FROM pg_stat_activity WHERE wait_event='PgSleep' AND query LIKE '%$marker%'")
    [[ "$count" -gt 0 ]] && return 0
    sleep 0.1
  done
  echo 'Timed out waiting for isolated test transaction.' >&2
  return 1
}
psql_test postgres -f "$repo/tests/generation-private/bootstrap.sql" -f "$repo/migrations/20261118_generation_private.sql" -f "$repo/tests/generation-private/sql-test.sql"
if psql_test postgres -f "$repo/migrations/20261118_generation_private.sql" >"$work/reapply.log" 2>&1; then echo 'migration unexpectedly replaced existing objects'; exit 1; fi
grep -q 'already exists' "$work/reapply.log"
psql_test postgres -At -c "SELECT to_regprocedure('public.sipurai_generation_tx(text,text,uuid,uuid,bigint,jsonb)') IS NOT NULL" | grep -q '^t$'
echo 'existing object collision: migration refused without replacing RPC'
psql_test postgres -c "INSERT INTO public.books (id,created_by,status,cover_image,is_public) VALUES ('22222222-2222-4222-8222-222222222222','owner','draft','',false)" >/dev/null
psql_test postgres -c "SET ROLE service_role; BEGIN; SELECT public.sipurai_generation_tx('acquire','owner','22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',NULL,'{\"newQuotaKey\":\"22222222-2222-4222-8222-222222222222\",\"seed\":{}}'); SELECT pg_sleep(2); COMMIT;" >"$work/first.log" 2>&1 &
first_pid=$!
wait_for_transaction 22222222-2222-4222-8222-222222222222
if psql_test postgres -c "SET ROLE service_role; SELECT public.sipurai_generation_tx('acquire','owner','22222222-2222-4222-8222-222222222222','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',NULL,'{}');" >"$work/second.log" 2>&1; then echo 'concurrent lease unexpectedly succeeded'; exit 1; fi
wait "$first_pid"
grep -q lease_busy "$work/second.log"
echo 'concurrent transactions: second lease rejected'
createdb -h "$work/socket" -U "$pguser" duplicates
tail -n +2 "$repo/tests/generation-private/bootstrap.sql" > "$work/bootstrap-no-roles.sql"
psql_test duplicates -f "$work/bootstrap-no-roles.sql" >/dev/null
psql_test duplicates -c "INSERT INTO public.pages(book_id,created_by,page_number) VALUES ('11111111-1111-4111-8111-111111111111','owner',0),('11111111-1111-4111-8111-111111111111','owner',0)" >/dev/null
if psql_test duplicates -f "$repo/migrations/20261118_generation_private.sql" >"$work/duplicate.log" 2>&1; then echo 'migration unexpectedly accepted duplicates'; exit 1; fi
grep -q 'could not create unique index' "$work/duplicate.log"
psql_test duplicates -At -c "SELECT count(*)=2 AND NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='sipurai_generation_private') FROM public.pages" | grep -q '^t$'
echo 'duplicate legacy rows: migration rolled back without data loss'
psql_test postgres -f "$repo/tests/generation-private/completion-setup.sql" >/dev/null
psql_test postgres -c "SET ROLE service_role; BEGIN; SELECT public.sipurai_generation_tx('bookWrite','owner','66666666-6666-4666-8666-666666666666','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,'{\"expected\":{\"status\":\"generating\",\"cover_image\":\"cover\"},\"patch\":{\"status\":\"complete\"}}'); SELECT pg_sleep(2); COMMIT;" >"$work/completion.log" 2>&1 &
completion_pid=$!
wait_for_transaction 66666666-6666-4666-8666-666666666666
if psql_test postgres -c "SET ROLE service_role; SET lock_timeout='500ms'; UPDATE public.pages SET image_url='' WHERE book_id='66666666-6666-4666-8666-666666666666';" >"$work/page-editor.log" 2>&1; then echo 'page edit did not wait for completion'; exit 1; fi
grep -q 'lock timeout' "$work/page-editor.log"
wait "$completion_pid"
echo 'completion snapshot: concurrent existing-page edit blocked until commit'
createdb -h "$work/socket" -U "$pguser" landscape
psql_test landscape -f "$work/bootstrap-no-roles.sql" >/dev/null
psql_test landscape -c 'ALTER TABLE public.books DROP COLUMN print_size' >/dev/null
psql_test landscape -f "$repo/migrations/20261108_book_print_size.sql" -f "$repo/migrations/20261118_landscape_proof.sql" -f "$repo/tests/generation-private/landscape-test.sql"
echo 'historical trim constraints and landscape aspect guard passed'
