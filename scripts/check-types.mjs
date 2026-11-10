/**
 * check-types.mjs - the type-check gate.
 *
 * The code base has a backlog of type errors that is too big to fix in one go, so the gate does not
 * demand zero. It demands "never worse": it runs `tsc -p jsconfig.json` and compares every error, by
 * IDENTITY (file + error code + message text, not line number), with typecheck-baseline.json.
 * Swapping one old error for a new one in the same file is therefore caught, not just a higher count.
 *
 *   node scripts/check-types.mjs            fail if any (file, error) appears more often than in the
 *                                           baseline, or an unknown kind of compiler output shows up
 *   node scripts/check-types.mjs --update   write the baseline from the current state; refuses to
 *                                           add or raise anything unless you also pass --allow-increase
 *
 * Lowering the baseline (after you fixed errors): run with --update and commit the new JSON.
 * The gate also fails when the baseline is STALE-HIGH (errors were fixed but not locked in).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASELINE = path.join(ROOT, 'typecheck-baseline.json');
const args = new Set(process.argv.slice(2));
const BACKSLASH = String.fromCharCode(92);

function runTsc() {
  const r = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'jsconfig.json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  /** @type {Record<string, Record<string, number>>} */
  const files = {};
  const unexpected = [];
  let total = 0;
  for (const line of out.split(/\r?\n/)) {
    if (!/error TS\d+/.test(line)) continue; // continuation lines of a multi-line message
    const m = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
    if (!m) {
      unexpected.push(line); // e.g. a global diagnostic with no file
      continue;
    }
    const file = m[1].split(BACKSLASH).join('/');
    const sig = `${m[4]}: ${m[5].replace(/\s+/g, ' ').trim()}`;
    files[file] ||= {};
    files[file][sig] = (files[file][sig] || 0) + 1;
    total += 1;
  }
  if (unexpected.length) {
    console.error('tsc printed diagnostics the gate cannot attribute to a file:\n' + unexpected.slice(0, 10).join('\n'));
    process.exit(2);
  }
  // tsc exits 2 when there are errors. Non-zero with nothing parsed means the checker itself failed.
  if (total === 0 && r.status !== 0) {
    console.error('tsc failed without reporting errors; the gate cannot trust a count of 0.\n' + out.slice(0, 2000));
    process.exit(2);
  }
  return { total, files };
}

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const current = runTsc();

/** (file, sig) pairs where a has more than b */
function diff(a, b) {
  const out = [];
  for (const [f, sigs] of Object.entries(a)) {
    for (const [sig, n] of Object.entries(sigs)) {
      const was = b[f]?.[sig] || 0;
      if (n > was) out.push({ f, sig, was, n });
    }
  }
  return out;
}

if (args.has('--update')) {
  const old = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : null;
  if (old && !args.has('--allow-increase')) {
    const worse = diff(current.files, old.files);
    if (worse.length) {
      console.error('Refusing to add or raise errors in the baseline (use --allow-increase if you really mean it):');
      for (const w of worse.slice(0, 30)) console.error(`  ${w.f}: ${w.sig.slice(0, 110)} (${w.was} -> ${w.n})`);
      process.exit(1);
    }
  }
  const files = sortObj(Object.fromEntries(Object.entries(current.files).map(([f, s]) => [f, sortObj(s)])));
  writeFileSync(BASELINE, JSON.stringify({ total: current.total, files }, null, 2) + '\n');
  console.log(`Baseline written: ${current.total} errors in ${Object.keys(files).length} files.`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error('typecheck-baseline.json is missing. Run: node scripts/check-types.mjs --update');
  process.exit(2);
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8'));

const worse = diff(current.files, base.files);
const better = diff(base.files, current.files);

console.log(`Type errors: ${current.total} now, baseline ${base.total}.`);
if (worse.length) {
  console.error('\nFAIL: new type errors (not in the baseline):');
  for (const w of worse.slice(0, 40)) console.error(`  ${w.f}: ${w.sig.slice(0, 140)}${w.was ? ` (${w.was} -> ${w.n})` : ''}`);
  console.error('\nFix them, or if they are unavoidable run: node scripts/check-types.mjs --update --allow-increase');
  process.exit(1);
}
if (better.length) {
  console.error('\nFAIL: you fixed type errors, so lock the progress in (otherwise new errors could hide in the freed room):');
  for (const b of better.slice(0, 40)) console.error(`  ${b.f}: ${b.sig.slice(0, 110)}`);
  console.error('\nRun: node scripts/check-types.mjs --update   and commit typecheck-baseline.json');
  process.exit(1);
}
console.log('OK: no new type errors.');
