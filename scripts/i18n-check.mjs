#!/usr/bin/env node
/**
 * i18n-check.mjs - the language gate (contract I-02). It only lets things get better.
 *
 * It takes every finding of scripts/i18n-audit.mjs and scripts/i18n-punctuation.mjs and compares them,
 * by IDENTITY (measure + file + signature), with scripts/i18n-baseline.json:
 *   - signature = the key for missing keys, a hash of the normalised text for hard-coded text.
 *   - a finding that is not in the baseline FAILS, even if an old finding disappeared in the same file.
 *   - a baseline entry that no longer exists FAILS ("fixed: remove it from the baseline", run
 *     --update-baseline): a ratchet, because an unused allowance would let the same text come back later.
 *     --allow-stale turns that into a warning (for a branch that must stay mergeable meanwhile).
 *   - a finding that moved to another path with the same signature is matched across paths (a rename or
 *     move does not fail; it warns that the baseline path is out of date).
 *
 *   node scripts/i18n-check.mjs                          check the working tree against the baseline
 *   node scripts/i18n-check.mjs --base-ref origin/main   ALSO verify the baseline itself was not raised
 *                                                        compared with that git revision
 *   node scripts/i18n-check.mjs --update-baseline        rewrite the baseline; refuses to add findings
 *                                                        unless --force (CI still catches a raised baseline)
 *   node scripts/i18n-check.mjs --self-test              prove every rule can pass and can fail
 *
 * Raising the baseline in a pull request is blocked by --base-ref, unless the PR has the label
 * "i18n-baseline-raise" (the workflow turns the label into I18N_BASELINE_OVERRIDE=1). The label is applied
 * by a reviewer, not by a file in the PR, so a PR cannot approve itself. Removing entries is always allowed.
 *
 * Exit codes: 0 pass, 1 something got worse, 2 the tool cannot be trusted (control fixture or self-test
 * failed, baseline missing or unreadable, a locale file cannot be read exactly, Babel missing).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_LOCALES, HERE, MEASURES, ToolError, mkProject, rmProject, runAuditControl, scanProject, totalsOf,
} from './i18n-audit.mjs';
import { ALLOW, problemOf, scanPunctuation } from './i18n-punctuation.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(opt('--root') || path.join(HERE, '..'));
const BASELINE_PATH = path.resolve(opt('--baseline') || path.join(HERE, 'i18n-baseline.json'));
const BASELINE_REL = 'scripts/i18n-baseline.json';
const VERSION = 2;

// ---------------------------------------------------------------------------------------------
// findings -> baseline shape, comparison
// ---------------------------------------------------------------------------------------------
export function scanAll(root) {
  const a = scanProject(root);
  const p = scanPunctuation(root);
  const files = { ...a.files };
  for (const [f, rec] of Object.entries(p.files)) files[f] = { ...(files[f] || {}), ...rec };
  return { files, stats: a.stats };
}

const strip = (files) => {
  const out = {};
  for (const [f, rec] of Object.entries(files)) for (const [m, sigs] of Object.entries(rec)) for (const [s, e] of Object.entries(sigs)) {
    (((out[f] ||= {})[m] ||= {})[s] = { n: e.n, p: e.p, ...(e.lines ? { lines: e.lines } : {}) });
  }
  return out;
};

function flat(files) {
  const m = new Map();
  for (const [file, rec] of Object.entries(files)) for (const [measure, sigs] of Object.entries(rec)) for (const [sig, e] of Object.entries(sigs)) {
    const k = `${measure}\u0000${sig}`;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push({ file, n: e.n, p: e.p || '', lines: e.lines || [] });
  }
  return m;
}

/** Exact (file, measure, signature) first; leftovers are matched across paths (moves); the rest is added / fixed. */
export function diffIdentities(curFiles, baseFiles) {
  const cur = flat(curFiles);
  const base = flat(baseFiles);
  const added = []; const fixed = []; const moved = [];
  for (const k of new Set([...cur.keys(), ...base.keys()])) {
    const [measure, sig] = k.split('\u0000');
    const cl = cur.get(k) || []; const bl = base.get(k) || [];
    const leftC = []; const leftB = [];
    for (const c of cl) { const b = bl.find((x) => x.file === c.file); const r = c.n - Math.min(c.n, b ? b.n : 0); if (r > 0) leftC.push({ ...c, n: r }); }
    for (const b of bl) { const c = cl.find((x) => x.file === b.file); const r = b.n - Math.min(b.n, c ? c.n : 0); if (r > 0) leftB.push({ ...b, n: r }); }
    const sumC = leftC.reduce((x, e) => x + e.n, 0); const sumB = leftB.reduce((x, e) => x + e.n, 0);
    const mv = Math.min(sumC, sumB);
    if (mv > 0) moved.push({ measure, sig, p: (leftC[0] || leftB[0]).p, from: leftB.map((e) => e.file), to: leftC.map((e) => e.file) });
    let skip = mv;
    for (const e of leftC) { const take = Math.min(skip, e.n); skip -= take; if (e.n - take > 0) added.push({ measure, sig, file: e.file, n: e.n - take, p: e.p, lines: e.lines }); }
    skip = mv;
    for (const e of leftB) { const take = Math.min(skip, e.n); skip -= take; if (e.n - take > 0) fixed.push({ measure, sig, file: e.file, n: e.n - take, p: e.p }); }
  }
  return { added, fixed, moved };
}

/** The pure decision. cur/base are { file: { measure: { sig: {n} } } }. */
export function gate({ cur, base, baseOfBase = null, allowStale = false, override = false }) {
  const problems = []; const warnings = []; const notes = [];
  const d = diffIdentities(cur, base);
  for (const a of d.added) problems.push(`NEW ${a.measure}  ${a.file}  ${a.measure === 'missingHe' || a.measure === 'missingEn' || a.measure === 'wrongParent' || a.measure === 'punct' ? a.sig : `"${a.p}"`}${a.lines && a.lines.length ? `  lines: ${a.lines.join(', ')}` : ''}${a.n > 1 ? `  (x${a.n})` : ''}`);
  for (const f of d.fixed) (allowStale ? warnings : problems).push(`FIXED, remove it from the baseline (run: node scripts/i18n-check.mjs --update-baseline)  ${f.measure}  ${f.file}  ${f.measure.startsWith('missing') || f.measure === 'wrongParent' || f.measure === 'punct' ? f.sig : `"${f.p}"`}`);
  for (const m of d.moved) warnings.push(`MOVED ${m.measure} "${m.p}" ${m.from.join(',')} -> ${m.to.join(',')} (baseline path out of date; update it when convenient)`);
  if (baseOfBase) {
    const b = diffIdentities(base, baseOfBase);
    if (b.added.length) {
      const lines = b.added.map((a) => `BASELINE RAISED ${a.measure}  ${a.file}  ${a.measure.startsWith('missing') || a.measure === 'wrongParent' || a.measure === 'punct' ? a.sig : `"${a.p}"`}`);
      if (override) { warnings.push(...lines.map((l) => `${l}  (allowed by override label)`)); notes.push('override active: baseline raise allowed by label i18n-baseline-raise'); } else problems.push(...lines, 'the baseline may only shrink in a pull request; a reviewer can allow a raise with the label "i18n-baseline-raise"');
    }
  }
  return { ok: problems.length === 0, problems, warnings, notes, diff: d };
}

// ---------------------------------------------------------------------------------------------
// baseline file
// ---------------------------------------------------------------------------------------------
function serialize(files, totals) {
  const L = [];
  L.push('{');
  L.push(` "version": ${VERSION},`);
  L.push(' "note": "Generated by scripts/i18n-check.mjs. One entry per finding: measure > signature > {n: how many, p: preview}. May only shrink. Lower it with: node scripts/i18n-check.mjs --update-baseline",');
  L.push(` "totals": ${JSON.stringify(totals)},`);
  L.push(' "files": {');
  const fl = Object.keys(files).sort();
  fl.forEach((f, fi) => {
    L.push(`  ${JSON.stringify(f)}: {`);
    const ms = MEASURES.filter((m) => files[f][m]);
    ms.forEach((m, mi) => {
      L.push(`   ${JSON.stringify(m)}: {`);
      const sg = Object.keys(files[f][m]).sort();
      sg.forEach((s, si) => L.push(`    ${JSON.stringify(s)}: ${JSON.stringify({ n: files[f][m][s].n, p: files[f][m][s].p })}${si < sg.length - 1 ? ',' : ''}`));
      L.push(`   }${mi < ms.length - 1 ? ',' : ''}`);
    });
    L.push(`  }${fi < fl.length - 1 ? ',' : ''}`);
  });
  L.push(' }');
  L.push('}');
  return `${L.join('\n')}\n`;
}

export function parseBaseline(text, where) {
  let j;
  try { j = JSON.parse(text); } catch (e) { throw new ToolError(`baseline unreadable (${where}): ${e.message}`); }
  if (!j || j.version !== VERSION || !j.files || typeof j.files !== 'object') throw new ToolError(`baseline (${where}) is not version ${VERSION}: regenerate with --update-baseline`);
  for (const [f, rec] of Object.entries(j.files)) for (const [m, sigs] of Object.entries(rec)) {
    if (!MEASURES.includes(m)) throw new ToolError(`baseline (${where}) has an unknown measure "${m}" in ${f}`);
    for (const [s, e] of Object.entries(sigs)) if (!e || !Number.isInteger(e.n) || e.n < 1) throw new ToolError(`baseline (${where}) has a bad entry ${f} ${m} ${s}`);
  }
  return j;
}

/** The baseline as committed on another revision. null when that revision has no baseline (first introduction). */
export function readBaselineAt(root, ref) {
  try {
    const out = execFileSync('git', ['show', `${ref}:${BASELINE_REL}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return parseBaseline(out, `${ref}:${BASELINE_REL}`);
  } catch (e) {
    const msg = String(e.stderr || e.message);
    if (/exists on disk, but not in|does not exist in|path .* does not exist/.test(msg)) return null;
    if (e instanceof ToolError && /is not version/.test(e.message)) return null; // old count-based format: nothing comparable
    if (e instanceof ToolError) throw e;
    throw new ToolError(`cannot read the baseline at "${ref}": ${msg.trim().split('\n')[0]}`);
  }
}

// ---------------------------------------------------------------------------------------------
// workflow lint (rule 5): a text check of .github/workflows/i18n.yml
// ---------------------------------------------------------------------------------------------
export function lintWorkflow(text) {
  const bad = [];
  if (!/^permissions:\s*\n\s+contents:\s*read\s*$/m.test(text)) bad.push('top-level "permissions: contents: read" is missing');
  if (/:\s*write\b/.test(text)) bad.push('a write permission is present');
  if (!/persist-credentials:\s*false/.test(text)) bad.push('checkout must set persist-credentials: false');
  const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
  if (!uses.length) bad.push('no actions found');
  for (const m of uses) {
    if (!/@[0-9a-f]{40}$/.test(m[1])) bad.push(`action not pinned to a full commit SHA: ${m[1]}`);
    else if (!/#\s*v\d/.test(m[2])) bad.push(`pinned action without its version in a comment: ${m[1]}`);
  }
  if (/\bsecrets\./.test(text)) bad.push('the workflow references secrets');
  if (/pull_request_target/.test(text)) bad.push('pull_request_target is not allowed');
  const on = text.match(/^on:\s*\n((?:[ \t]+.*\n|\s*\n)+)/m);
  if (!on) bad.push('no "on:" block');
  else {
    const triggers = [...on[1].matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
    if (!triggers.length || triggers.some((t) => !['pull_request', 'push'].includes(t))) bad.push(`triggers must be only pull_request and push, found: ${triggers.join(', ') || 'none'}`);
    if (!/push:\s*\n\s+branches:\s*\[main\]/.test(on[1])) bad.push('push must be limited to branches: [main]');
  }
  const ci = text.indexOf('npm ci');
  const st = text.indexOf('i18n-check.mjs --self-test');
  const real = text.search(/node scripts\/i18n-check\.mjs(?! --self-test)/);
  if (ci < 0) bad.push('"npm ci" is missing');
  if (st < 0) bad.push('the self-test step is missing');
  else if (real >= 0 && real < st) bad.push('the self-test must run before the real check');
  if (real < 0) bad.push('the real check step is missing');
  return bad;
}

// ---------------------------------------------------------------------------------------------
// self-test: every rule must be able to pass AND to fail
// ---------------------------------------------------------------------------------------------
const L = 'src/components/i18n/locales';
function withProject(map, fn) {
  const d = mkProject({ ...BASE_LOCALES, ...map });
  try { return fn(d); } finally { rmProject(d); }
}
const scanMap = (map) => withProject(map, (d) => scanAll(d));
const totalsFor = (map) => totalsOf(scanMap(map).files);
const throwsTool = (map) => { try { scanMap(map); return false; } catch (e) { return e instanceof ToolError; } };
const okGate = (cur, base, o = {}) => gate({ cur: strip(cur), base: strip(base), ...o });

export function selfTest() {
  const results = [];
  const t = (name, fn) => { let ok = false; try { ok = fn() === true; } catch (e) { ok = false; results.push({ name: `${name} (threw: ${e.message})`, ok }); return; } results.push({ name, ok }); };

  // ---- rule 1: identities, not counts
  const A = { 'src/pages/X.jsx': 'export default () => <p>{t("m.one")}{isHebrew ? "אחד" : "One"}</p>;' };
  const A2 = { 'src/pages/X.jsx': 'export default () => <p>{t("m.two")}{isHebrew ? "אחד" : "One"}</p>;' }; // same count, other key
  const A3 = { 'src/pages/X.jsx': 'export default () => <p>{t("m.one")}{isHebrew ? "שניים" : "Two"}</p>;' }; // same count, other text
  const A4 = { 'src/pages/X.jsx': 'export default () => <p>{isHebrew ? "אחד" : "One"}</p>;' }; // one finding fixed
  const A5 = { 'src/pages/Y.jsx': A['src/pages/X.jsx'] }; // renamed file
  const A6 = { ...A, 'src/pages/Z.jsx': 'export default () => <p>{t("m.one")}</p>;' }; // same key used in a second file
  const base = scanMap(A).files;
  t('r1 unchanged passes', () => okGate(base, base).ok);
  t('r1 a different missing key with the same count FAILS', () => !okGate(scanMap(A2).files, base).ok);
  t('r1 different hard-coded text with the same count FAILS', () => !okGate(scanMap(A3).files, base).ok);
  t('r1 a fixed finding FAILS until the baseline shrinks', () => !okGate(scanMap(A4).files, base).ok);
  t('r1 a fixed finding only warns with --allow-stale', () => { const g = okGate(scanMap(A4).files, base, { allowStale: true }); return g.ok && g.warnings.length > 0; });
  t('r1 a pure file rename passes (warns)', () => { const g = okGate(scanMap(A5).files, base); return g.ok && g.warnings.some((w) => w.startsWith('MOVED')); });
  t('r1 same key in a second file FAILS', () => !okGate(scanMap(A6).files, base).ok);

  // ---- rule 2: the baseline cannot be raised silently
  const small = scanMap(A4).files;
  t('r2 baseline unchanged vs base passes', () => okGate(base, base, { baseOfBase: strip(base) }).ok);
  t('r2 baseline with an added finding FAILS', () => !okGate(base, base, { baseOfBase: strip(small) }).ok);
  t('r2 the same raise passes with the override label', () => okGate(base, base, { baseOfBase: strip(small), override: true }).ok);
  t('r2 a baseline that shrank passes', () => okGate(small, small, { baseOfBase: strip(base) }).ok);
  t('r2 a baseline whose entry only moved path passes', () => okGate(scanMap(A5).files, scanMap(A5).files, { baseOfBase: strip(base) }).ok);
  t('r2 reads the base revision from git (and a missing file means "first introduction")', () => {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'agent-i18ngit-'));
    try {
      const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'pipe' });
      g('init', '-q'); g('config', 'user.email', 'x@x'); g('config', 'user.name', 'x');
      fs.writeFileSync(path.join(d, 'f'), '1'); g('add', 'f'); g('commit', '-qm', 'a');
      const none = readBaselineAt(d, 'HEAD') === null;
      fs.mkdirSync(path.join(d, 'scripts')); fs.writeFileSync(path.join(d, BASELINE_REL), serialize(strip(base), totalsOf(base)));
      g('add', '-A'); g('commit', '-qm', 'b');
      const got = readBaselineAt(d, 'HEAD');
      let badRef = false; try { readBaselineAt(d, 'no-such-ref'); } catch (e) { badRef = e instanceof ToolError; }
      return none && got && got.version === VERSION && badRef;
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
  t('r2 a malformed baseline stops the tool', () => { try { parseBaseline('{"version":2,"files":{"a":{"nope":{}}}}', 'x'); return false; } catch (e) { return e instanceof ToolError; } });

  // ---- rule 3: coverage (each: found, and the clean twin is not)
  const one = (jsx) => totalsFor({ 'src/pages/C.jsx': `export default () => (${jsx});` });
  t('r3 one-word English JSX text found', () => one('<button>Save</button>').enText === 1);
  t('r3 brand/unit token and numbers not flagged', () => { const x = one('<p>Sipurai 12 PDF</p>'); return x.enText === 0 && x.hebText === 0; });
  t('r3 {\'Hello world\'} in JSX found', () => one("<p>{'Hello world'}</p>").enText === 1);
  t('r3 template literal in JSX found', () => one('<p>{`Hello there`}</p>').enText === 1);
  t('r3 text inside a {cond ? a : b} child found', () => one("<p>{ok ? 'Yes' : 'No'}</p>").enText === 2);
  t('r3 a className string is not flagged', () => one('<p className="text-lg font-bold">{x}</p>').enText === 0);
  t('r3 English title / placeholder / alt / label props found', () => { const x = one('<i title="Open it" placeholder="Name" alt="Cover" label="Size" />'); return x.enProp === 4; });
  t('r3 Hebrew prop found', () => one('<i placeholder="שם" />').hebProp === 1);
  t('r3 English aria-label found, Hebrew aria-label is a Hebrew prop', () => { const x = one('<i aria-label="Close" /> '); const y = one('<i aria-label="סגירה" />'); return x.enAria === 1 && y.enAria === 0 && y.hebProp === 1; });
  t('r3 i18n.t and props.t missing keys found', () => { const x = one('<p>{i18n.t("no.such")}{props.t("no.such2")}</p>'); return x.missingHe === 2 && x.missingEn === 2; });
  t('r3 existing key through a member call is clean', () => { const x = one('<p>{i18n.t("a.b")}</p>'); return x.missingHe === 0; });
  t('r3 dynamic keys counted as their own measure', () => { const x = one('<p>{t(k)}{t(`a.${k}`)}</p>'); return x.dynamicKey === 2 && x.missingHe === 0; });
  t('r3 a key under another parent is flagged as wrongParent', () => { const x = one('<p>{t("deep.x")}</p>'); return x.wrongParent === 1 && x.missingHe === 1; });
  t('r3 TypeScript source is scanned', () => totalsFor({ 'src/lib/h.tsx': 'export const A = () => <b>Save now</b>;' }).enText === 1);
  t('r3 a syntax error is counted, not skipped', () => totalsFor({ 'src/pages/Bad.jsx': 'export default function ( { return <div ;' }).parseError >= 1);

  // ---- rule 4: locales are read exactly or the tool stops
  t('r4 a spread in a locale stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'const o = {}; export default { ...o, a: { b: "x" } };' }));
  t('r4 a syntax error in a locale stops the tool', () => throwsTool({ [`${L}/en.jsx`]: 'export default { a: { b: "x" }, };; }' }));
  t('r4 an unsupported expression in a locale stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'const x = "q"; export default { a: { b: x } };' }));
  t('r4 a duplicate key stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'export default { a: { b: "x", b: "y" } };' }));
  t('r4 a key defined in a fragment and the main file stops the tool', () => throwsTool({ [`${L}/he/f.js`]: 'export default { a: { b: "dup" } };' }));
  t('r4 a clean fragment is read', () => totalsFor({ [`${L}/he/f.js`]: 'export default { frag: { k: "כן" } };', [`${L}/en/f.js`]: 'export default { frag: { k: "Yes" } };', 'src/pages/F.jsx': 'export default () => <p>{t("frag.k")}</p>;' }).missingHe === 0);
  t('r4 a bare prefix of a nested key is not a text', () => one('<p>{t("nested")}{t("nested.deep")}</p>').missingHe === 2);
  t('r4 an empty text counts as missing (t() would return the key)', () => withProject({ [`${L}/he.jsx`]: 'export default { a: { b: "" } };', 'src/pages/E.jsx': 'export default () => <p>{t("a.b")}</p>;' }, (d) => totalsOf(scanProject(d).files).missingHe === 1));

  // ---- punctuation (contract I-02 part 3)
  t('punct "!שלום" flagged', () => problemOf('!שלום') !== null);
  t('punct a Hebrew value ending with an opening quote flagged', () => problemOf('שלום "') !== null && problemOf('שלום (') !== null);
  t('punct a clean Hebrew value, and a Latin-only value, are not flagged', () => problemOf('שלום!') === null && problemOf('!Hello') === null);
  t('punct is found in a fragment and ratcheted like the rest', () => {
    const m = { [`${L}/he/f.js`]: 'export default { frag: { bad: "!שלום", good: "שלום!" } };' };
    const cur = scanMap(m).files; const none = scanMap({}).files;
    return totalsOf(cur).punct === 1 && !okGate(cur, none).ok && okGate(cur, cur).ok;
  });
  t('punct the allow list works', () => ALLOW.length >= 0 && Array.isArray(ALLOW));

  // ---- rule 5 / 6: the workflow
  const GOOD = [
    'name: Language check', 'on:', '  pull_request:', '    branches: [main]', '  push:', '    branches: [main]', 'permissions:', '  contents: read',
    'jobs:', '  i18n:', '    runs-on: ubuntu-latest', '    steps:', `      - uses: actions/checkout@${'a'.repeat(40)} # v7.0.1`, '        with:', '          persist-credentials: false',
    `      - uses: actions/setup-node@${'b'.repeat(40)} # v7.1.0`, '      - run: npm ci', '      - run: node scripts/i18n-check.mjs --self-test', '      - run: node scripts/i18n-check.mjs --base-ref x', '',
  ].join('\n');
  t('r5 a correct workflow passes the lint', () => lintWorkflow(GOOD).length === 0);
  t('r5 missing permissions FAILS', () => lintWorkflow(GOOD.replace('permissions:\n  contents: read\n', '')).length > 0);
  t('r5 a write permission FAILS', () => lintWorkflow(GOOD.replace('contents: read', 'contents: write')).length > 0);
  t('r5 persist-credentials missing FAILS', () => lintWorkflow(GOOD.replace('persist-credentials: false', 'persist-credentials: true')).length > 0);
  t('r5 an action pinned to a tag FAILS', () => lintWorkflow(GOOD.replace(/checkout@a{40} # v7.0.1/, 'checkout@v4')).length > 0);
  t('r5 a pinned action without a version comment FAILS', () => lintWorkflow(GOOD.replace(' # v7.1.0', '')).length > 0);
  t('r5 secrets FAIL', () => lintWorkflow(`${GOOD}      - run: echo \${{ secrets.X }}\n`).length > 0);
  t('r5 pull_request_target FAILS', () => lintWorkflow(GOOD.replace('  pull_request:', '  pull_request_target:')).length > 0);
  t('r5 an extra trigger FAILS', () => lintWorkflow(GOOD.replace('  push:', '  workflow_dispatch:\n  push:')).length > 0);
  t('r5 push to every branch FAILS', () => lintWorkflow(GOOD.replace(/  push:\n {4}branches: \[main\]/, '  push:')).length > 0);
  t('r6 the workflow must self-test before the real check', () => lintWorkflow(GOOD.replace('--self-test', '--noop')).length > 0 && lintWorkflow(GOOD.replace('      - run: node scripts/i18n-check.mjs --self-test\n', '').replace('node scripts/i18n-check.mjs --base-ref x', 'node scripts/i18n-check.mjs --base-ref x\n      - run: node scripts/i18n-check.mjs --self-test')).length > 0);
  const real = path.join(ROOT, '.github/workflows/i18n.yml');
  t('r5 the real .github/workflows/i18n.yml passes the lint', () => fs.existsSync(real) && lintWorkflow(fs.readFileSync(real, 'utf8')).length === 0);
  return results;
}

// ---------------------------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------------------------
function main() {
  if (flag('--self-test')) {
    const r = selfTest();
    for (const x of r) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.name}`);
    const bad = r.filter((x) => !x.ok).length;
    console.log(`self-test: ${r.length - bad}/${r.length} passed`);
    return bad ? 2 : 0;
  }
  const fx = runAuditControl();
  console.log(`control fixture: ${fx.pass ? 'pass' : 'FAIL'}`);
  if (!fx.pass) throw new ToolError('control fixture failed; refusing to report numbers.');

  const { files, stats } = scanAll(ROOT);
  const totals = totalsOf(files);
  const exists = fs.existsSync(BASELINE_PATH);

  if (flag('--update-baseline')) {
    if (exists) {
      let old = null;
      try { old = parseBaseline(fs.readFileSync(BASELINE_PATH, 'utf8'), BASELINE_PATH); } catch (e) {
        if (!(e instanceof ToolError) || !/is not version/.test(e.message)) throw e;
        console.log('note: the existing baseline has the old count-based format; replacing it with the identity format');
      }
      const d = old ? diffIdentities(strip(files), old.files) : { added: [] };
      if (d.added.length && !flag('--force')) {
        console.error(`refusing to add ${d.added.length} finding(s) to the baseline; fix them or pass --force:`);
        for (const a of d.added) console.error(`  ${a.measure}  ${a.file}  ${a.sig}`);
        return 1;
      }
    }
    fs.writeFileSync(BASELINE_PATH, serialize(strip(files), totals));
    console.log(`baseline written: ${path.relative(ROOT, BASELINE_PATH)}`);
    console.log(`totals: ${JSON.stringify(totals)}  scanned: ${stats.filesScanned} files`);
    return 0;
  }

  if (!exists) throw new ToolError(`baseline not found: ${BASELINE_PATH}. Create it with --update-baseline.`);
  const baseline = parseBaseline(fs.readFileSync(BASELINE_PATH, 'utf8'), BASELINE_PATH);
  let baseOfBase = null;
  const ref = opt('--base-ref');
  if (ref) {
    const b = readBaselineAt(ROOT, ref);
    if (b) baseOfBase = b.files; else console.log(`note: no baseline at ${ref}: first introduction, base comparison skipped`);
  }
  const g = gate({ cur: strip(files), base: baseline.files, baseOfBase, allowStale: flag('--allow-stale'), override: process.env.I18N_BASELINE_OVERRIDE === '1' });
  console.log(`scanned ${stats.filesScanned} files (out of scope, counted not read: ui ${stats.outOfScope.ui}, tests ${stats.outOfScope.test})`);
  console.log(`totals now: ${JSON.stringify(totals)}`);
  for (const n of g.notes) console.log(`note: ${n}`);
  for (const w of g.warnings) console.log(`warning: ${w}`);
  if (!g.ok) {
    console.error(`\nFAIL: ${g.problems.length} problem(s):\n`);
    for (const p of g.problems) console.error(`  ${p}`);
    console.error('\nNew text belongs in the locale files and is used with t("...").');
    return 1;
  }
  console.log('OK: nothing got worse.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(main()); } catch (e) {
    if (e instanceof ToolError) { console.error(`i18n-check: ${e.message}`); process.exit(2); }
    throw e;
  }
}
