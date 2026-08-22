/**
 * check-api-modules.mjs — guards against the class of bug that took production
 * story generation down for 33 days (2026-07-05 → 2026-08-07).
 *
 * `api/ai/generate.js` shipped with a duplicate `const parts` declaration. That is a
 * PARSE-time SyntaxError, so the Vercel function never loaded and every request —
 * including OPTIONS, which returns on line 5 — answered 500 FUNCTION_INVOCATION_FAILED.
 * Nothing caught it: the Vite build never touches api/, and vitest's `include` is
 * `src/**` only. The module was never parsed by anything in CI.
 *
 * The gate is `node --check` per file: a pure parse, with no environment variables and
 * no installed dependencies involved. That matters — a gate that needs env or deps
 * fails for reasons unrelated to code quality, and a gate that cries wolf gets removed.
 * A file that will not parse cannot serve a request, in any environment, ever.
 *
 * Usage: node scripts/check-api-modules.mjs
 * Exit 0 = every api module parses. Exit 1 = at least one will 500 in production.
 */
import { readdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = path.resolve(import.meta.dirname, '..');
const API_DIR = path.join(ROOT, 'api');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = (await walk(API_DIR)).sort();

// Fail closed: an empty sweep means the check itself is broken, which is worse
// than a broken module because it reports success while inspecting nothing.
if (files.length === 0) {
  console.error('✗ No .js modules found under api/ — this check is not doing its job.');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  try {
    await run(process.execPath, ['--check', file]);
    console.log(`✓ ${rel}`);
  } catch (err) {
    const detail = String(err.stderr || err.message)
      .split('\n')
      .find((line) => /Error/.test(line)) || 'failed to parse';
    console.error(`✗ ${rel} — ${detail.trim()}`);
    failed += 1;
  }
}

console.log('──────────────────────────────────────────');
if (failed > 0) {
  console.error(`RESULT: ${failed} of ${files.length} api module(s) will not parse. These WILL 500 in production.`);
  process.exit(1);
}
console.log(`RESULT: all ${files.length} api module(s) parse cleanly.`);
