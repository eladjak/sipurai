# Offline corrective-work bridge

This optional local bridge transforms the **raw aggregate fixture schema** documented in README.md using `createDailyQualitySnapshot`. It never trusts a supplied snapshot or proposal. It emits a single fixed work item or `null`, with validated aggregate evidence, an acceptance check, rollback instruction, and `human_review_required`. It reads at most one 1 MiB regular fixture; it writes only to stdout and cannot execute changes, make requests, start workers, publish, send messages or incur paid inference. Public HEAD pilot snapshots are not aggregate fixtures and do not establish a corrective item. A count is evidence of a symptom, not its cause.

Run in a private test environment with synthetic or explicitly authorized input:

```sh
printf 'enabled\n' > /private/path/quality-work-gate
SIPURAI_QUALITY_WORK_ENABLED=true node scripts/quality/corrective-work-cli.mjs scripts/quality/fixtures/day.json /private/path/quality-work-gate
node --test scripts/quality/corrective-work.test.mjs
```

The exact environment value `true` and a regular, non-symlink gate file containing exactly `enabled` plus a newline are both required. Missing, unreadable, changed or invalid gate means disabled (exit 2, empty stdout). The gate is checked before fixture access and immediately before output; the tiny interval after the final check is not atomic with stdout. Stop an already running consumer as well for an immediate halt. A future consumer must independently check the same gate before each side effect and use an atomic persistence boundary; this CLI alone is not an authorization or cross-process lock. Protect the gate and output directory from untrusted modification. Invalid fixtures fail with a fixed diagnostic and no output. There is no scheduler, persistence or deduplication: invoking it again repeats the same deterministic item; a future scheduler must enforce one item per reporting day and prevent concurrent runs.

## Staged path to automation (not implemented or enabled)

1. Establish approved, privacy-preserving metric sources, coverage and denominators; validate snapshots and retain a private, immutable daily record. A public HEAD result alone must not be converted into a product quality finding.
2. Choose owner, runtime, caps, retention and a kill switch; enforce independent daily, concurrency and cumulative compute/provider budgets before acquiring any resource. A zero budget means no run. Reserve budget atomically and stop on uncertainty, exhaustion or missing evidence. Prevent duplicates using an atomic daily claim and stable item identity.
3. A future worker may reproduce a qualifying item on an isolated branch with synthetic data only, scoped files, no secrets, production access or network by default. It must stop on ambiguous evidence or an unsafe change, preserve existing books and produce a patch plus tests and rollback.
4. Run isolated CI and independent substantive review against acceptance criteria and actual diff. Failed or unavailable tests/review block advancement; do not silently retry or ship. Explicitly authorize release separately under the existing release rules; protect production, spending and user data.
5. Once the owner selects destinations and permissions, derive the daily short message, designed PDF and archive link from the same validated snapshot. No delivery occurs here. Review the output and retain delivery evidence before declaring delivery complete.
