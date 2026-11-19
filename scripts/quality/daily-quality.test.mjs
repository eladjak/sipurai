import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createDailyQualitySnapshot, MAX_INPUT_BYTES } from './daily-quality.mjs';

const fixture = fileURLToPath(new URL('./fixtures/day.json', import.meta.url));
const cli = fileURLToPath(new URL('./daily-quality-cli.mjs', import.meta.url));
const input = () => JSON.parse(readFileSync(fixture, 'utf8'));
function run(path, enabled) {
  return spawnSync(process.execPath, [cli, path], {
    encoding: 'utf8', env: { ...process.env, SIPURAI_QUALITY_DAILY_ENABLED: enabled },
    timeout: 2_000,
  });
}

test('reports denominators, distinguishes zero from unavailable and produces one repeatable proposal', () => {
  const snapshot = createDailyQualitySnapshot(input());
  assert.deepEqual(snapshot, createDailyQualitySnapshot(input()));
  assert.deepEqual(snapshot.metrics.sample, {
    books: 1, pages: 3, missingIllustrations: 1,
    hebrewLetters: 8, vowelMarkedHebrewLetters: 2, testedTextPages: 2,
  });
  assert.deepEqual(snapshot.metrics.generation, {
    sampled: 3, stuck: 1, oldestStuckMinutes: 31, illustrationFailures: 1,
  });
  assert.deepEqual(snapshot.metrics.feedback, { responses: 0, negative: 0 });
  assert.equal(snapshot.comparison.metrics.feedback, null);
  assert.equal(snapshot.proposal.code, 'recover_stuck_generation');
  assert.deepEqual(snapshot.proposal.evidence, { today: 1, comparableDay: 1 });
});

test('counts Unicode marks as coverage on Hebrew letters, excluding isolated marks and shin dots', () => {
  const data = input();
  data.current.sampleBooks = [{ pages: [{ illustrated: true, text: 'שׁ בּ שָׁ שּׁ ﭏ בׇ בֹֺ Aָ 😀ָ' }] }];
  const { sample } = createDailyQualitySnapshot(data).metrics;
  assert.equal(sample.hebrewLetters, 6);
  assert.equal(sample.vowelMarkedHebrewLetters, 3);
});

test('requires recurring evidence or a reproducible broken smoke path', () => {
  const data = input();
  data.comparison = null;
  assert.equal(createDailyQualitySnapshot(data).proposal, null);
  data.current.smokePassed = false;
  assert.equal(createDailyQualitySnapshot(data).proposal.code, 'repair_smoke_path');
});

test('discards raw envelope fields, book text and arbitrary labels', () => {
  const data = input();
  data.privateUser = 'SECRET_USER@example.test';
  data.current.sampleBooks[0].pages[0].text = 'SECRET_STORY';
  data.current.aggregates.errors.rawLog = 'SECRET_LOG';
  data.current.aggregates.feedback.comment = 'SECRET_FEEDBACK';
  data.current.generations[0].id = 'SECRET_GENERATION';
  data.current.generations[1].failure = 'SECRET_PROVIDER_ERROR';
  assert.doesNotMatch(JSON.stringify(createDailyQualitySnapshot(data)), /SECRET/);
});

test('rejects impossible counts, invalid dates, and row and text budget overruns', () => {
  const data = input();
  data.current.aggregates.visual.faceOverlap = 4;
  assert.throws(() => createDailyQualitySnapshot(data), /invalid_count/);
  data.current.aggregates.visual.faceOverlap = 0;
  data.current.sampleBooks = Array.from({ length: 2 }, () => ({ pages: Array.from({ length: 126 }, () => ({ illustrated: true })) }));
  assert.throws(() => createDailyQualitySnapshot(data), /page_budget/);
  data.current.sampleBooks = [{ pages: [{ illustrated: true, text: 'x'.repeat(4001) }] }];
  assert.throws(() => createDailyQualitySnapshot(data), /text_budget/);
  assert.throws(() => createDailyQualitySnapshot({ ...input(), day: '2026-02-31' }), /invalid_day/);
  assert.throws(() => createDailyQualitySnapshot({ ...input(), comparison: { day: '2026-11-13' } }), /invalid_comparison_day/);
});

test('fail-closed kill switch refuses the fixture before reading and emits only stable diagnostics', () => {
  for (const flag of ['', 'false', '1', 'True']) {
    const result = run('SECRET_MISSING_PATH', flag);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '{"error":"disabled"}\n');
  }
  const missing = run('SECRET_MISSING_PATH', 'true');
  assert.equal(missing.status, 1);
  assert.equal(missing.stdout, '');
  assert.equal(missing.stderr, '{"error":"fixture_unavailable"}\n');
  const active = run(fixture, 'true');
  assert.equal(active.status, 0);
  assert.equal(active.stderr, '');
  assert.deepEqual(JSON.parse(active.stdout), createDailyQualitySnapshot(input()));
});

test('byte budget and malformed fixtures produce no snapshot and leak no input', t => {
  const dir = mkdtempSync(join(tmpdir(), 'sipurai-quality-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'private-fixture.json');
  writeFileSync(path, 'x'.repeat(MAX_INPUT_BYTES + 1));
  let result = run(path, 'true');
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '{"error":"byte_budget"}\n');
  writeFileSync(path, 'SECRET_MALFORMED');
  result = run(path, 'true');
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '{"error":"invalid_json"}\n');
});
