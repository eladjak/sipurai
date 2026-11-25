# Sharing privacy regression

Run from the repository root with the locally available `postgres:18.7` Docker image:

```sh
./tests/share-privacy/run-local.sh before
./tests/share-privacy/run-local.sh after
```

Both commands run the same synthetic two-phase fixture. The first must exit nonzero with `stale public title visible to anon`; the second applies the migration before the fixture and must exit zero. Docker uses a disposable container with its own PID namespace, no network and a read-only source mount. No external database or credentials are used.

The fixture models the existing permissive owner and public policies, owner-only books RLS, and public definer views. It checks anon, unrelated authenticated, listing owner and comment owner visibility; public, private, orphaned and bookless posts; and the public book and page views. The insert after unpublishing reproduces a cleanup race. This fixture does not establish the actual deployed schema, privileges, role settings or view ownership; those require separate review before applying a migration.
