# Isolated PostgreSQL generation test

`bootstrap.sql` creates synthetic data and simulates existing service-role privileges inside a disposable database; the actual migration makes no ACL changes. The SQL tests cover owner/service isolation, quota provenance, atomic book and seed creation, fenced leases and expiry, parent-edit preservation, immutable checkpoints, idempotent skeletons, batch rollback, complete-state guards and account-deletion cascade. The runner tests simultaneous lease requests, an existing-page edit during completion, rollback on historical duplicate pages, and the original print-size migration followed by the landscape aspect guard.

Run the script **directly as PID 1 in a new PID namespace**. It refuses to start outside that condition, starts a temporary server as an ordinary user on a private Unix socket with TCP disabled, stops only that server with `pg_ctl`, and removes its own temporary directory.

```sh
unshare --fork --pid --mount-proc ./tests/generation-private/run-local.sh
```

The default PostgreSQL paths come from `pg_config`; if server binaries are not installed there, set `PG_BINDIR` and `PG_SHAREDIR` to a matching extracted server distribution, for example:

```sh
unshare --fork --pid --mount-proc env PG_BINDIR=/path/to/pgsql/bin PG_SHAREDIR=/path/to/pgsql/share ./tests/generation-private/run-local.sh
```

When run as root, the server runs as `nobody` using `runuser`; otherwise it runs as the invoking user. No production connection is used. These tests do not replace staging against actual Supabase default privileges, role settings and schema. The live pages table has no book FK: inserts by older writers outside this protocol can still race the per-book completion snapshot, and later edits can invalidate a completed book.
