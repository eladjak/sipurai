import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { israelDay, runPublicQualityPilot } from './public-quality-pilot.mjs';

const now = new Date('2026-11-19T22:30:00Z');
const cli = fileURLToPath(new URL('./public-quality-pilot-cli.mjs', import.meta.url));

test('uses the local reporting day across Israel summer and winter offsets', () => {
  assert.equal(israelDay(now), '2026-11-20');
  assert.equal(israelDay(new Date('2026-07-19T21:30:00Z')), '2026-07-20');
  assert.equal(israelDay(new Date('2026-11-19T21:30:00Z')), '2026-11-19');
});

test('default-off CLI exits before resolving a private state path', () => {
  const result = spawnSync(process.execPath, [cli], {
    env: { ...process.env, SIPURAI_QUALITY_DAILY_ENABLED: 'False', STATE_DIRECTORY: '/missing/PRIVATE_PATH' },
    encoding: 'utf8', timeout: 2_000,
  });
  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '{"outcome":"disabled"}\n');
});

test('CLI rejects an enabled run with a public state directory before creating a claim', t => {
  const directory = mkdtempSync(fileURLToPath(new URL('./.pilot-test-', import.meta.url)));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  chmodSync(directory, 0o755);
  const result = spawnSync(process.execPath, [cli], {
    env: { ...process.env, SIPURAI_QUALITY_DAILY_ENABLED: 'true', STATE_DIRECTORY: directory },
    encoding: 'utf8', timeout: 2_000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '{"outcome":"invalid_state_permissions"}\n');
  assert.deepEqual(readdirSync(directory), []);
});

test('disabled gate stops reservation, network and snapshot writes', async () => {
  const unexpected = () => assert.fail('disabled run invoked side effect');
  assert.equal(await runPublicQualityPilot({
    enabled: () => false, reserve: unexpected, transport: unexpected, publish: unexpected, now,
  }), 'disabled');
});

test('a daily claim stops repeat reads and writes', async () => {
  const unexpected = () => assert.fail('claimed run invoked side effect');
  assert.equal(await runPublicQualityPilot({
    enabled: () => true,
    reserve: day => { assert.equal(day, '2026-11-20'); return false; },
    transport: unexpected, publish: unexpected, now,
  }), 'claimed');
});

test('a switch flipped during collection stops more reads and never publishes', async () => {
  let enabled = true;
  let calls = 0;
  const result = await runPublicQualityPilot({
    enabled: () => enabled, reserve: () => true, now,
    transport: async () => {
      calls++;
      enabled = false;
      return { status: 200, contentType: 'text/html' };
    },
    publish: () => assert.fail('published after kill switch'),
  });
  assert.equal(result, 'disabled');
  assert.equal(calls, 1);
});

test('writes one fixed public snapshot and leaves unrelated measures unavailable', async () => {
  const calls = [];
  let published;
  const result = await runPublicQualityPilot({
    enabled: () => true, reserve: () => true, now,
    transport: async url => {
      calls.push(url.href);
      if (calls.length === 1) return { status: 200, contentType: 'text/html; charset=utf-8', rawLog: 'SECRET' };
      if (calls.length === 2) return { status: 302, location: 'https://private.test/SECRET' };
      return { status: 200, contentType: 'text/html' };
    },
    publish: (day, snapshot) => { assert.equal(day, '2026-11-20'); published = snapshot; return true; },
  });
  assert.equal(result, 'written');
  assert.deepEqual(calls, ['https://www.sipurai.ai/', 'https://www.sipurai.ai/samples/demo-dragons-garden',
    'https://www.sipurai.ai/images/spx/styles/storybook.webp']);
  assert.equal(published.source, 'public_route_probe');
  assert.deepEqual(published.metrics, {
    sample: null, generation: null, visual: null, timing: null, funnel: null, errors: null, feedback: null, smokePassed: null,
  });
  assert.equal(published.proposal, null);
  assert.deepEqual(published.publicProbe.results, {
    home: { status: 200, mimeMatches: true, reachable: true, issue: null },
    sample: { status: 302, mimeMatches: null, reachable: false, issue: null },
    storybookArt: { status: 200, mimeMatches: false, reachable: false, issue: null },
  });
  assert.doesNotMatch(JSON.stringify(published), /SECRET|private.test/);
});

test('keeps only stable failure codes for transport errors, timeout and header overflow', async () => {
  let call = 0;
  const failures = [new Error('SECRET'), { name: 'AbortError' }, { code: 'HPE_HEADER_OVERFLOW' }];
  const result = await runPublicQualityPilot({
    enabled: () => true, reserve: () => true, now,
    transport: async () => { throw failures[call++]; },
    publish: (_day, { publicProbe }) => {
      assert.deepEqual(Object.values(publicProbe.results).map(m => m.issue), ['transport', 'timeout', 'header_budget']);
      assert.ok(Object.values(publicProbe.results).every(m => m.status === null && m.reachable === null));
      return true;
    },
  });
  assert.equal(result, 'written');
});
