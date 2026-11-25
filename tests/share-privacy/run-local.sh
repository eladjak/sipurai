#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in before|after) phase=$1 ;; *) echo 'Usage: tests/share-privacy/run-local.sh before|after' >&2; exit 2 ;; esac
repo=$(cd "$(dirname "$0")/../.." && pwd)
# Docker creates a private PID namespace. No host process is signalled and the
# source is read-only; PostgreSQL uses the container's disposable filesystem.
docker run --rm --network none --mount "type=bind,src=$repo,dst=/src,readonly" --env "PHASE=$phase" --entrypoint bash postgres:18.7 -c '
set -euo pipefail
mkdir -p /tmp/share-pg /tmp/share-socket
chown postgres:postgres /tmp/share-pg /tmp/share-socket
gosu postgres initdb -D /tmp/share-pg --no-locale --encoding=UTF8 --auth=trust --no-sync >/dev/null
gosu postgres pg_ctl -D /tmp/share-pg -o "-k /tmp/share-socket -c listen_addresses=" -l /tmp/share-pg/server.log -w start >/dev/null
trap "gosu postgres pg_ctl -D /tmp/share-pg -m fast -w stop >/dev/null" EXIT
psql -X -q -h /tmp/share-socket -U postgres -d postgres -v ON_ERROR_STOP=1 -f /src/tests/share-privacy/bootstrap.sql >/dev/null
if [[ "$PHASE" == after ]]; then
  psql -X -q -h /tmp/share-socket -U postgres -d postgres -v ON_ERROR_STOP=1 -f /src/scripts/migrations/2026-11-25-community-book-privacy.sql >/dev/null
fi
psql -X -q -h /tmp/share-socket -U postgres -d postgres -v ON_ERROR_STOP=1 -f /src/tests/share-privacy/regression.sql | sed "/^$/d; /^t$/d"
'
