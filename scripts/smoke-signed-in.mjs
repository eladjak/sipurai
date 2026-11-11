#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { targetFor } from '../e2e/signed-in/guard.js';

let target;
try { target = targetFor(); } catch { console.log('SMOKE FAIL: target refused (0 passed, 0 failed, 0 skipped)'); process.exit(1); }
// Never forward Playwright output: it can contain URLs, account names, or session details.
const dir = mkdtempSync(join(resolve(process.cwd(), '..'), 'smoke-'));
const output = join(dir, 'result.json');
try {
  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: output };
  const result = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--project=signed-in', '--no-deps', '--reporter=json', 'e2e/signed-in/main-flow.spec.js', 'e2e/signed-in/admin.spec.js'], { env, stdio: 'ignore', timeout: 180000 });
  let counts = { passed: 0, failed: 0, skipped: 0 };
  try {
    const report = JSON.parse(readFileSync(output, 'utf8'));
    const walk = (suite) => {
      for (const spec of suite.specs || []) for (const item of spec.tests || []) {
        const key = item.status === 'expected' ? 'passed' : item.status === 'skipped' ? 'skipped' : 'failed';
        counts[key]++;
      }
      for (const child of suite.suites || []) walk(child);
    };
    for (const suite of report.suites || []) walk(suite);
  } catch { /* Missing JSON is reported as a runner failure below. */ }
  const valid = counts.passed + counts.failed + counts.skipped > 0;
  const ok = result.status === 0 && valid && counts.failed === 0;
  const readOnlyComplete = target.readOnly && counts.passed === 1 && counts.skipped === 2;
  console.log(`SMOKE ${ok ? (counts.skipped && !readOnlyComplete ? 'INCOMPLETE' : 'PASS') : 'FAIL'}: ${counts.passed} passed, ${counts.failed} failed, ${counts.skipped} skipped${counts.skipped ? ` (${target.readOnly ? 'production read-only restriction or missing credentials' : target.local ? 'local credentials missing or local admin fixtures unavailable' : 'test credentials missing'})` : ''}`);
  if (!ok) console.log('Diagnostics: run Playwright directly for failure details; its output can contain sensitive data.');
  process.exitCode = ok && (target.local || counts.skipped === 0 || readOnlyComplete) ? 0 : 1;
} finally { rmSync(dir, { recursive: true, force: true }); }
