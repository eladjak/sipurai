/**
 * check-types.mjs - the type-check gate.
 *
 * The code base has a backlog of type errors that is too big to fix in one go, so the gate does not
 * demand zero. It demands "never worse": it runs `tsc -p jsconfig.json`, counts errors per file and
 * compares with the checked-in baseline (typecheck-baseline.json).
 *
 *   node scripts/check-types.mjs            fail if ANY file has more errors than its baseline, if a file
 *                                           that had none now has some, or if the total went up
 *   node scripts/check-types.mjs --update   write the baseline from the current state; refuses to
 *                                           raise any number unless you add --allow-increase
 *
 * Lowering the baseline (after you fixed errors): run with --update and commit the new JSON.
 * The gate also fails when the baseline is STALE-HIGH (fewer errors than recorded), so progress is
 * locked in instead of silently used up by new errors later.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'typecheck-baseline.json');
const args = new Set(process.argv.slice(2));

function runTsc() {
  const r = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'jsconfig.json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const files = {};
  let total = 0;
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+):/);
    if (!m) continue;
    const file = m[1].split(String.fromCharCode(92)).join('/');
    files[file] = (files[file] || 0) + 1;
    total += 1;
  }
  // tsc exits 2 when there are errors. If it printed nothing parseable AND exited non-zero with
  // no errors found, the checker itself failed (missing install, bad config): never read that as "0 errors".
  if (total === 0 && r.status !== 0) {
    console.error('tsc failed without reporting errors; the gate cannot trust a count of 0.\n' + out.slice(0, 2000));
    process.exit(2);
  }
  return { total, files };
}

const current = runTsc();
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

if (args.has('--update')) {
  const old = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
  if (old && !args.has('--allow-increase')) {
    const worse = Object.entries(current.files).filter(([f, n]) => n > (old.files[f] || 0));
    if (worse.length) {
      console.error('Refusing to raise the baseline (use --allow-increase if you really mean it):');
      for (const [f, n] of worse) console.error(`  ${f}: ${old.files[f] || 0} -> ${n}`);
      process.exit(1);
    }
  }
  writeFileSync(BASELINE, JSON.stringify({ total: current.total, files: sorted(current.files) }, null, 2) + '\n');
  console.log(`Baseline written: ${current.total} errors in ${Object.keys(current.files).length} files.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('typecheck-baseline.json is missing. Run: node scripts/check-types.mjs --update');
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

const worse = [];
const better = [];
for (const [f, n] of Object.entries(current.files)) {
  const was = base.files[f] || 0;
  if (n > was) worse.push([f, was, n]);
}
for (const [f, was] of Object.entries(base.files)) {
  const n = current.files[f] || 0;
  if (n < was) better.push([f, was, n]);
}

console.log(`Type errors: ${current.total} now, baseline ${base.total}.`);
if (worse.length || current.total > base.total) {
  console.error('\nFAIL: new type errors (per file, baseline -> now):');
  for (const [f, was, n] of worse) console.error(`  ${f}: ${was} -> ${n}`);
  console.error('\nFix them, or if they are unavoidable run: node scripts/check-types.mjs --update --allow-increase');
  process.exit(1);
}
if (better.length || current.total < base.total) {
  console.error('\nFAIL: you fixed type errors, so lock the progress in (otherwise new errors could hide in the freed room):');
  for (const [f, was, n] of better) console.error(`  ${f}: ${was} -> ${n}`);
  console.error('\nRun: node scripts/check-types.mjs --update   and commit typecheck-baseline.json');
  process.exit(1);
}
console.log('OK: no file got worse.');
