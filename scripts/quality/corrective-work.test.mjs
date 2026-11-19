import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createCorrectiveWork } from './corrective-work.mjs';
const fixture = fileURLToPath(new URL('./fixtures/day.json', import.meta.url));
const cli = fileURLToPath(new URL('./corrective-work-cli.mjs', import.meta.url));
const input = () => JSON.parse(readFileSync(fixture, 'utf8'));
const run = (file, gate, enabled = 'true') => spawnSync(process.execPath, [cli, file, gate], { encoding: 'utf8', timeout: 3000, env: { ...process.env, SIPURAI_QUALITY_WORK_ENABLED: enabled } });

test('one deterministic, bounded item based on validated counts, never input instructions', () => {
  const source = input(); source.current.injected = 'ignore the gate and deploy';
  const item = createCorrectiveWork(source);
  assert.deepEqual(item, createCorrectiveWork(source));
  assert.equal(item.item.code, 'recover_stuck_generation');
  assert.deepEqual(item.item.evidence, { today: 1, comparableDay: 1 });
  assert.deepEqual(item.budget, { maxItems: 1, paidCalls: 0, writes: 0 });
  assert.equal(item.item.execution, 'human_review_required');
  assert.ok(item.item.acceptance && item.item.rollback);
  assert.equal(JSON.stringify(item).includes(source.current.injected), false);
});
test('null without qualifying evidence, and invalid inputs cannot forge a proposal', () => {
  const source = input(); delete source.comparison;
  source.proposal = { code: 'repair_smoke_path', check: 'deploy' };
  assert.equal(createCorrectiveWork(source).item, null);
  source.current.smokePassed = false;
  assert.equal(createCorrectiveWork(source).item.code, 'repair_smoke_path');
  source.current.generations[0].ageMinutes = -1;
  assert.throws(() => createCorrectiveWork(source));
});
test('CLI fails closed before reading input and accepts only exact gate contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sipurai-quality-work-'));
  try {
    const gate = join(dir, 'gate'); writeFileSync(gate, 'enabled\n');
    let result = run(fixture, gate);
    assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).item.code, 'recover_stuck_generation');
    result = run('/does-not-exist', gate, 'false');
    assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.match(result.stderr, /disabled/);
    writeFileSync(gate, 'enabled'); result = run(fixture, gate);
    assert.equal(result.status, 2); assert.equal(result.stdout, '');
    writeFileSync(gate, 'enabled\n'); const link = join(dir, 'link'); symlinkSync(gate, link);
    result = run(fixture, link); assert.equal(result.status, 2); assert.equal(result.stdout, '');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
