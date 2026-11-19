# Offline Sipurai quality snapshot

This CLI reads a local UTF-8 JSON fixture and writes one JSON snapshot to stdout. It uses no dependencies beyond Node. Only synthetic or explicitly authorized test data belongs in the fixture. The CLI treats every input field as data and copies only validated dates, fixed labels, booleans and aggregate numbers to output.

```sh
SIPURAI_QUALITY_DAILY_ENABLED=true node scripts/quality/daily-quality-cli.mjs scripts/quality/fixtures/day.json
node --test scripts/quality/daily-quality.test.mjs
```

Only the exact value `true` enables the CLI. The process checks it before opening its single input file and before emitting the snapshot. A disabled run exits 2. Input or I/O failures exit 1. Failure emits only a stable JSON error code on stderr and leaves stdout empty. The imported `createDailyQualitySnapshot(input)` function does pure calculation for tests and callers. A future scheduled caller must use the outer gate before reading and again at its own persistence boundary.

## Fixture fields

| Field | Shape |
| --- | --- |
| `schemaVersion` | Integer `1`. |
| `day` | Calendar date `YYYY-MM-DD` for Israel. The CLI does not infer the reporting day from the host clock. |
| `current` | Window object as described below. |
| `comparison` | Optional window object with a `day` exactly seven calendar days earlier. This compares like weekdays and is not a trailing seven-day average. |

Window fields may be missing or null. A metric with no supplied observations is null in the snapshot. An explicitly supplied empty array or zero denominator produces observed zero counts.

| Window field | Shape |
| --- | --- |
| `sampleBooks` | Array of objects with a required `pages` array. Each page has boolean `illustrated` and optional `text`. The summary counts missing illustrations, text pages tested, Hebrew letters and Hebrew letters with at least one following vowel mark. It uses Unicode canonical decomposition. Dagesh, cantillation and shin/sin dots alone do not count as vowels. The metric measures coverage and does not assess linguistic correctness. |
| `generations` | Array of objects with `state` (`queued`, `running`, `completed` or `failed`), integer `ageMinutes`, and optional `failure`. Only the fixed value `illustration` on a failed record increments illustration failures. Queued or running at 30 minutes or older counts as stuck. |
| `aggregates.visual` | `checkedPages`, `qualityIssues`, `textOverflow`, `faceOverlap`. Counts are supplied by a reviewer or fixture, with no image processing in this tool. |
| `aggregates.timing` | `samples`, `p95Ms`. Supply a p95 in whole milliseconds when samples are positive and null otherwise. |
| `aggregates.funnel` | `started`, `manuscriptReady`, `bookReady`, using distinct runs in one comparable cohort. Levels are cumulative and cannot increase. |
| `aggregates.errors` | `attempts`, `failedAttempts`, `repeatedErrorAttempts`. Repeated-error attempts must be a subset of failed attempts. |
| `aggregates.feedback` | `responses`, `negative`. Supply counts only. Keep responses and user identifiers out of the fixture. |
| `smokePassed` | Boolean observed result from the offline smoke path. An explicit failure has first proposal priority. |

Integer measures are nonnegative and bounded to 10,000,000. Subset counts cannot exceed denominators. The CLI accepts regular files up to 1 MiB. Each window accepts at most 250 books, 250 pages in total, 250 generation rows and 4,000 UTF-16 code units per page of text. Unknown fields are ignored.

The snapshot contains at most one proposal. After a broken smoke path, priority goes to stuck generation, missing illustration, failed illustration generation, face overlap, overflow, visual issues and recurring errors, in that order. An issue needs a positive count in both comparable windows. A proposal supplies a fixed severity, counts or smoke result, a reproduction check and a rollback instruction. It performs no repair.
