#!/usr/bin/env node
/**
 * i18n-check.mjs - the language gate (contract I-02). It only lets things get better.
 *
 * It takes every finding of scripts/i18n-audit.mjs and scripts/i18n-punctuation.mjs and compares them,
 * by IDENTITY (measure + file + signature), with scripts/i18n-baseline.json:
 *   - signature = the key for missing keys; a hash of the normalised text for hard-coded text;
 *     key + hash of the value for punctuation.
 *   - a finding that is not in the baseline FAILS, even if an old finding disappeared in the same file.
 *   - a finding counts as MOVED (does not fail) only when its file was RENAMED: git rename detection against
 *     --base-ref, or an identical file content hash at the new path while the old path no longer exists.
 *     The same text appearing in a different EXISTING file is a NEW finding.
 *   - a baseline entry that no longer exists (a finding was fixed) is only a WARNING that prints the exact
 *     command to shrink the baseline. It does not fail, so parallel pull requests that each fix strings
 *     do not conflict on the baseline file.
 *
 *   node scripts/i18n-check.mjs                          check the working tree against the baseline
 *   node scripts/i18n-check.mjs --base-ref origin/main   ALSO verify the baseline was not raised compared with
 *                                                        the merge-base of that git revision
 *   node scripts/i18n-check.mjs --update-baseline        rewrite the baseline; refuses to add findings
 *                                                        unless --force
 *   node scripts/i18n-check.mjs --self-test              prove every rule can pass and can fail
 *
 * Languages: Hebrew and English are REQUIRED (a t() key must be a non-empty string in both). Yiddish is hidden
 * from users by an owner decision, so Yiddish coverage is printed on every run (count and first keys) but never
 * fails. See the header of scripts/i18n-audit.mjs for what is and is not measured.
 *
 * LIMITS, said plainly: THIS CHECK STOPS ACCIDENTS, NOT A DETERMINED AUTHOR. The pull request being judged
 * carries this script, its self-test, the baseline and the workflow, so its author can change any of them
 * (including the override). The label "i18n-baseline-raise" lets a baseline raise pass, but it is only a
 * speed bump: anyone who can label the PR can set it, and it is not tied to a reviewed commit. Real protection
 * is code review of changes to scripts/i18n-* and .github/workflows/i18n.yml (for example CODEOWNERS plus a
 * required review), which this repository has to provide.
 *
 * Exit codes: 0 pass, 1 something got worse, 2 the tool cannot be trusted (control fixture or self-test
 * failed, baseline missing or unreadable, a locale file cannot be read exactly, Babel missing).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_LOCALES, HERE, MEASURES, ToolError, hashOf, mkProject, rmProject, runAuditControl, scanProject, totalsOf,
} from './i18n-audit.mjs';
import { problemOf, scanPunctuation } from './i18n-punctuation.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(opt('--root') || path.join(HERE, '..'));
const BASELINE_PATH = path.resolve(opt('--baseline') || path.join(HERE, 'i18n-baseline.json'));
const BASELINE_REL = 'scripts/i18n-baseline.json';
const VERSION = 3;
const SHRINK_CMD = 'node scripts/i18n-check.mjs --update-baseline';

// ---------------------------------------------------------------------------------------------
// findings -> baseline shape, comparison
// ---------------------------------------------------------------------------------------------
export function scanAll(root) {
  const a = scanProject(root);
  const p = scanPunctuation(root);
  const files = { ...a.files };
  const hashes = { ...a.hashes };
  for (const [f, rec] of Object.entries(p.files)) {
    files[f] = { ...(files[f] || {}), ...rec };
    hashes[f] = hashOf(fs.readFileSync(path.join(root, f), 'utf8'));
  }
  return { files, hashes, stats: a.stats };
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

const KEYED = new Set(['missingHe', 'missingEn', 'wrongParent']);
const describe = (measure, sig, p) => {
  if (KEYED.has(measure)) return sig;
  if (measure === 'punct') return `${sig.split('#')[0]}  "${p}"`;
  return `"${p}"`;
};

/**
 * Exact (file, measure, signature) first. Leftovers are paired as a MOVE only if the old file was renamed to the
 * new one (git rename info, or same content hash while the old path is gone). The rest is added / fixed.
 * ctx: { curHashes, baseHashes, renames: Map(old->new), exists(path) }
 */
export function diffIdentities(curFiles, baseFiles, ctx = {}) {
  const curHashes = ctx.curHashes || {}; const baseHashes = ctx.baseHashes || {};
  const renames = ctx.renames || new Map(); const exists = ctx.exists || (() => true);
  const isRename = (a, b) => !exists(a) && (renames.get(a) === b || (!!baseHashes[a] && baseHashes[a] === curHashes[b]));
  const cur = flat(curFiles); const base = flat(baseFiles);
  const added = []; const fixed = []; const moved = [];
  for (const k of new Set([...cur.keys(), ...base.keys()])) {
    const [measure, sig] = k.split('\u0000');
    const cl = cur.get(k) || []; const bl = base.get(k) || [];
    const leftC = []; const leftB = [];
    for (const c of cl) { const b = bl.find((x) => x.file === c.file); const r = c.n - Math.min(c.n, b ? b.n : 0); if (r > 0) leftC.push({ ...c, n: r }); }
    for (const b of bl) { const c = cl.find((x) => x.file === b.file); const r = b.n - Math.min(b.n, c ? c.n : 0); if (r > 0) leftB.push({ ...b, n: r }); }
    for (const b of leftB) {
      for (const c of leftC) {
        if (b.n > 0 && c.n > 0 && isRename(b.file, c.file)) {
          const take = Math.min(b.n, c.n); b.n -= take; c.n -= take;
          moved.push({ measure, sig, p: c.p, from: b.file, to: c.file });
        }
      }
    }
    for (const c of leftC) if (c.n > 0) added.push({ measure, sig, file: c.file, n: c.n, p: c.p, lines: c.lines });
    for (const b of leftB) if (b.n > 0) fixed.push({ measure, sig, file: b.file, n: b.n, p: b.p });
  }
  return { added, fixed, moved };
}

/** The pure decision. cur/base/baseOfBase are { file: { measure: { sig: {n} } } }. */
export function gate({ cur, base, curHashes = {}, baseHashes = {}, baseOfBase = null, baseOfBaseHashes = {}, renames = new Map(), exists = () => true, override = false }) {
  const problems = []; const warnings = []; const notes = [];
  const d = diffIdentities(cur, base, { curHashes, baseHashes, renames, exists });
  for (const a of d.added) problems.push(`NEW ${a.measure}  ${a.file}  ${describe(a.measure, a.sig, a.p)}${a.lines && a.lines.length && a.lines[0] ? `  lines: ${a.lines.join(', ')}` : ''}${a.n > 1 ? `  (x${a.n})` : ''}`);
  for (const f of d.fixed) warnings.push(`FIXED ${f.measure}  ${f.file}  ${describe(f.measure, f.sig, f.p)}`);
  if (d.fixed.length) warnings.push(`${d.fixed.length} baseline entr${d.fixed.length === 1 ? 'y' : 'ies'} no longer exist. Shrink the baseline with: ${SHRINK_CMD}`);
  for (const m of d.moved) warnings.push(`MOVED ${m.measure} "${m.p}" ${m.from} -> ${m.to} (file renamed; baseline path out of date: ${SHRINK_CMD})`);
  if (baseOfBase) {
    const b = diffIdentities(base, baseOfBase, { curHashes: baseHashes, baseHashes: baseOfBaseHashes, renames, exists });
    if (b.added.length) {
      const lines = b.added.map((a) => `BASELINE RAISED ${a.measure}  ${a.file}  ${describe(a.measure, a.sig, a.p)}`);
      if (override) { warnings.push(...lines.map((l) => `${l}  (allowed by the override label)`)); notes.push('override active: baseline raise allowed by label i18n-baseline-raise'); } else problems.push(...lines, 'the baseline may only shrink in a pull request; a deliberate raise needs the label "i18n-baseline-raise" (see LIMITS in the script header)');
    }
  }
  return { ok: problems.length === 0, problems, warnings, notes, diff: d };
}

// ---------------------------------------------------------------------------------------------
// baseline file
// ---------------------------------------------------------------------------------------------
function serialize(files, totals, hashes) {
  const L = [];
  L.push('{');
  L.push(` "version": ${VERSION},`);
  L.push(` "note": "Generated by scripts/i18n-check.mjs. One entry per finding: file > measure > signature > {n: how many, p: preview}. fileHashes lets a pure rename be recognised. May only shrink. Shrink it with: ${SHRINK_CMD}",`);
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
  L.push(' },');
  L.push(' "fileHashes": {');
  fl.forEach((f, i) => L.push(`  ${JSON.stringify(f)}: ${JSON.stringify(hashes[f] || '')}${i < fl.length - 1 ? ',' : ''}`));
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
  j.fileHashes = j.fileHashes && typeof j.fileHashes === 'object' ? j.fileHashes : {};
  return j;
}

const git = (root, a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** The revision to compare with: the merge-base of ref and HEAD (so a base that moved on does not look like a raise). */
export function resolveBase(root, ref) {
  try { return git(root, ['merge-base', ref, 'HEAD']).trim() || ref; } catch { return ref; }
}

/** The baseline as committed on the merge-base of ref. null when there is none (first introduction / old format). */
export function readBaselineAt(root, ref) {
  const rev = resolveBase(root, ref);
  try {
    return parseBaseline(git(root, ['show', `${rev}:${BASELINE_REL}`]), `${ref}:${BASELINE_REL}`);
  } catch (e) {
    const msg = String(e.stderr || e.message);
    if (/exists on disk, but not in|does not exist in|path .* does not exist/.test(msg)) return null;
    if (e instanceof ToolError && /is not version/.test(e.message)) return null; // an older format: nothing comparable
    if (e instanceof ToolError) throw e;
    throw new ToolError(`cannot read the baseline at "${ref}": ${msg.trim().split('\n')[0]}`);
  }
}

/** Renames git can see between the merge-base of ref and the working tree: Map(old -> new). Empty if git cannot say. */
export function getRenames(root, ref) {
  const out = new Map();
  try {
    for (const line of git(root, ['diff', '-M', '--name-status', resolveBase(root, ref)]).split('\n')) {
      const m = line.match(/^R\d*\t([^\t]+)\t([^\t]+)$/);
      if (m) out.set(m[1], m[2]);
    }
  } catch { /* no git information: only the content-hash rule applies */ }
  return out;
}

// ---------------------------------------------------------------------------------------------
// workflow lint: a text check of .github/workflows/i18n.yml
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
  if (!/stops accidents, not a determined author/i.test(text)) bad.push('the header must state the limits ("stops accidents, not a determined author")');
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
const G = (curScan, baseScan, o = {}) => gate({ cur: strip(curScan.files), base: strip(baseScan.files), curHashes: curScan.hashes, baseHashes: baseScan.hashes, ...o });
const mkRepo = () => {
  const d = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'agent-i18ngit-'));
  const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'pipe', encoding: 'utf8' });
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 'x@x'); g('config', 'user.name', 'x');
  return { d, g };
};

export function selfTest() {
  const results = [];
  const t = (name, fn) => { let ok = false; try { ok = fn() === true; } catch (e) { results.push({ name: `${name} (threw: ${e.message})`, ok }); return; } results.push({ name, ok }); };
  const X = 'src/pages/X.jsx';

  // ---- rule 1: identities, not counts
  const A = { [X]: 'export default () => <p>{t("m.one")}{isHebrew ? "אחד" : "One"}</p>;' };
  const A2 = { [X]: 'export default () => <p>{t("m.two")}{isHebrew ? "אחד" : "One"}</p>;' }; // same count, other key
  const A3 = { [X]: 'export default () => <p>{t("m.one")}{isHebrew ? "שניים" : "Two"}</p>;' }; // same count, other text
  const A4 = { [X]: 'export default () => <p>{isHebrew ? "אחד" : "One"}</p>;' }; // one finding fixed
  const A6 = { ...A, 'src/pages/Z.jsx': 'export default () => <p>{t("m.one")}</p>;' }; // same key used in a second file
  const base = scanMap(A);
  t('r1 unchanged passes', () => G(base, base).ok);
  t('r1 a different missing key with the same count FAILS', () => !G(scanMap(A2), base).ok);
  t('r1 different hard-coded text with the same count FAILS', () => !G(scanMap(A3), base).ok);
  t('r1 same key in a second file FAILS', () => !G(scanMap(A6), base).ok);
  t('r1 a fixed finding is only a WARNING that prints the shrink command', () => {
    const g = G(scanMap(A4), base);
    return g.ok && g.warnings.some((w) => w.includes(`Shrink the baseline with: ${SHRINK_CMD}`)) && g.warnings.some((w) => w.startsWith('FIXED'));
  });
  t('r1 parallel PRs: two different fixes each pass on their own', () => {
    const two = scanMap({ ...A, 'src/pages/W.jsx': 'export default () => <p>{t("m.w")}</p>;' });
    return G(scanMap(A), two).ok && G(scanMap({ 'src/pages/W.jsx': 'export default () => <p>{t("m.w")}</p>;' }), two).ok;
  });

  // ---- moves are only renames
  const A5 = { 'src/pages/Y.jsx': A[X] }; // renamed, content identical
  const A5e = { 'src/pages/Y.jsx': `// edited\n${A[X]}` }; // renamed and edited
  const gone = (f) => f !== X; // the old path no longer exists
  t('r4 a pure rename (same content hash, old path gone) passes with a MOVED warning', () => { const g = G(scanMap(A5), base, { exists: gone }); return g.ok && g.warnings.some((w) => w.startsWith('MOVED')); });
  t('r4 a rename plus an edit, with no git rename info, FAILS', () => !G(scanMap(A5e), base, { exists: gone }).ok);
  t('r4 a rename plus an edit passes when git reports the rename', () => G(scanMap(A5e), base, { exists: gone, renames: new Map([[X, 'src/pages/Y.jsx']]) }).ok);
  const SAVE = 'export default () => <button>Save changes</button>;';
  const two1 = scanMap({ [X]: SAVE, 'src/pages/Y.jsx': 'export default () => <p>{t("a.b")}</p>;' });
  const two2 = scanMap({ [X]: 'export default () => <p>{t("a.b")}</p>;', 'src/pages/Y.jsx': SAVE });
  t('r4 the same text moved into a different EXISTING file FAILS', () => !G(two2, two1, { exists: () => true }).ok);
  t('r4 rename detection reads git', () => {
    const { d, g } = mkRepo();
    try {
      const body = `${'export const a = 1;\n'.repeat(40)}`;
      fs.writeFileSync(path.join(d, 'a.jsx'), body); g('add', '-A'); g('commit', '-qm', 'one');
      g('mv', 'a.jsx', 'b.jsx'); g('commit', '-qam', 'two');
      return getRenames(d, 'HEAD~1').get('a.jsx') === 'b.jsx' && getRenames(d, 'HEAD').size === 0;
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });

  // ---- rule 2: the baseline cannot be raised silently
  const small = scanMap(A4);
  const GB = (cur, b, bb, o = {}) => gate({ cur: strip(cur.files), base: strip(b.files), curHashes: cur.hashes, baseHashes: b.hashes, baseOfBase: strip(bb.files), baseOfBaseHashes: bb.hashes, ...o });
  t('r2 baseline unchanged vs base passes', () => GB(base, base, base).ok);
  t('r2 baseline with an added finding FAILS', () => !GB(base, base, small).ok);
  t('r2 the same raise passes with the override label', () => GB(base, base, small, { override: true }).ok);
  t('r2 a baseline that shrank passes', () => GB(small, small, base).ok);
  t('r2 a baseline whose entry only moved path (rename) passes', () => GB(scanMap(A5), scanMap(A5), base, { exists: gone }).ok);
  t('r2 reads the merge-base from git: a base that moved on does not look like a raise; a first introduction is "none"', () => {
    const { d, g } = mkRepo();
    try {
      fs.writeFileSync(path.join(d, 'f'), '1'); g('add', 'f'); g('commit', '-qm', 'a');
      const none = readBaselineAt(d, 'HEAD') === null;
      fs.mkdirSync(path.join(d, 'scripts'));
      fs.writeFileSync(path.join(d, BASELINE_REL), serialize(strip(base.files), totalsOf(base.files), base.hashes)); g('add', '-A'); g('commit', '-qm', 'big baseline');
      g('checkout', '-q', '-b', 'pr'); fs.writeFileSync(path.join(d, 'other'), 'x'); g('add', '-A'); g('commit', '-qm', 'pr work');
      g('checkout', '-q', 'main'); fs.writeFileSync(path.join(d, BASELINE_REL), serialize(strip(small.files), totalsOf(small.files), small.hashes)); g('commit', '-qam', 'main shrank the baseline');
      g('checkout', '-q', 'pr');
      const viaMergeBase = readBaselineAt(d, 'main'); // must be the BIG one (the merge-base), not main's smaller one
      const sameAsPr = viaMergeBase && !!viaMergeBase.files[X] && !!viaMergeBase.files[X].missingHe;
      let badRef = false; try { readBaselineAt(d, 'no-such-ref'); } catch (e) { badRef = e instanceof ToolError; }
      return none && sameAsPr === true && badRef;
    } finally { fs.rmSync(d, { recursive: true, force: true }); }
  });
  t('r2 a malformed baseline stops the tool', () => { try { parseBaseline('{"version":3,"files":{"a":{"nope":{}}}}', 'x'); return false; } catch (e) { return e instanceof ToolError; } });

  // ---- rule 3: coverage (each: found, and the clean twin is not)
  const one = (jsx) => totalsFor({ 'src/pages/C.jsx': `export default () => (${jsx});` });
  const body = (code) => totalsFor({ 'src/pages/C.jsx': code });
  t('r3 one-word English JSX text found', () => one('<button>Save</button>').enText === 1);
  t('r3 brand/unit token and numbers not flagged', () => { const x = one('<p>Sipurai 12 PDF</p>'); return x.enText === 0 && x.hebText === 0; });
  t('r3 {\'Hello world\'} in JSX found', () => one("<p>{'Hello world'}</p>").enText === 1);
  t('r3 template literal in JSX found', () => one('<p>{`Hello there`}</p>').enText === 1);
  t('r3 text inside a {cond ? a : b} child found', () => one("<p>{ok ? 'Yes' : 'No'}</p>").enText === 2);
  t('r3 a className string is not flagged', () => one('<p className="text-lg font-bold">{x}</p>').enText === 0);
  t('r3 English title / placeholder / alt / label props found', () => one('<i title="Open it" placeholder="Name" alt="Cover" label="Size" />').enProp === 4);
  t('r3 Hebrew prop found', () => one('<i placeholder="שם" />').hebProp === 1);
  t('r3 English aria-label found, Hebrew aria-label is a Hebrew prop', () => { const x = one('<i aria-label="Close" /> '); const y = one('<i aria-label="סגירה" />'); return x.enAria === 1 && y.enAria === 0 && y.hebProp === 1; });
  t('r3 i18n.t and props.t missing keys found', () => { const x = one('<p>{i18n.t("no.such")}{props.t("no.such2")}</p>'); return x.missingHe === 2 && x.missingEn === 2; });
  t('r3 existing key through a member call is clean', () => one('<p>{i18n.t("a.b")}</p>').missingHe === 0);
  t('r3 dynamic keys counted as their own measure', () => { const x = one('<p>{t(k)}{t(`a.${k}`)}</p>'); return x.dynamicKey === 2 && x.missingHe === 0; });
  t('r3 a key under another parent is flagged as wrongParent', () => { const x = one('<p>{t("deep.x")}</p>'); return x.wrongParent === 1 && x.missingHe === 1; });
  t('r3 TypeScript source is scanned', () => totalsFor({ 'src/lib/h.tsx': 'export const A = () => <b>Save now</b>;' }).enText === 1);
  t('r3 a syntax error is counted, not skipped', () => totalsFor({ 'src/pages/Bad.jsx': 'export default function ( { return <div ;' }).parseError >= 1);
  t('r3 a string constant that is rendered is found (once, even if rendered twice)', () => body('const label = "Create a story";\nexport default () => <div><button>{label}</button><i title={label} /></div>;').enText === 1);
  t('r3 a constant that is never rendered is not flagged', () => body('const label = "Create a story";\nexport default () => <div>{count}</div>;').enText === 0);
  t('r3 an aliased t (const tr = t) is checked', () => body('export default () => { const { t } = useI18n(); const tr = t; return <p>{tr("no.such")}</p>; };').missingHe === 1);
  t('r3 a renamed t from destructuring ({ t: tt }) is checked', () => body('export default () => { const { t: tt } = useI18n(); return <p>{tt("no.such")}</p>; };').missingHe === 1);
  t('r3 a fallback text passed to t() is found', () => body('export default () => <p>{t("a.b", "Create a story")}</p>;').enText === 1);
  t('r3 toast / alert text is found', () => body('export default () => { toast.success("Book saved"); alert("Are you sure?"); return null; };').enText === 2);
  t('r3 runtime concatenation inside JSX is found', () => body('export default () => <p>{"Hello there " + name}</p>;').enText === 1);
  t('r3 copy in objects rendered later is NOT a finding but is counted as unread', () => {
    const r = withProject({ 'src/pages/O.jsx': 'export const items = [{ label: "Create a story" }];\nexport default () => null;' }, (d) => scanProject(d));
    return totalsOf(r.files).enText === 0 && r.stats.unreadCopy === 1;
  });

  // ---- Hebrew and English are required; Yiddish is reported only
  const val = (v, lang) => withProject({ [`${L}/${lang}.jsx`]: `export default { a: { b: ${v} }, nested: { deep: { x: "x" } } };`, 'src/pages/V.jsx': 'export default () => <p>{t("a.b")}</p>;' }, (d) => totalsOf(scanProject(d).files));
  for (const lang of ['he', 'en']) {
    const key = lang === 'he' ? 'missingHe' : 'missingEn';
    t(`r7 ${lang}: null, false, 0, a function, a whitespace string and an array are missing`, () => ['null', 'false', '0', '() => "x"', '"  "', '["x"]', '""'].every((v) => val(v, lang)[key] === 1));
    t(`r7 ${lang}: a real string is present`, () => val('"טקסט"', lang)[key] === 0);
  }
  t('r7 a key without Yiddish is reported but does not fail the gate', () => {
    const r = withProject({ 'src/pages/V.jsx': 'export default () => <p>{t("nested.deep.x")}</p>;' }, (d) => { const x = scanProject(d); return { yi: x.stats.yiMissing, f: x.files }; });
    return r.yi.has('nested.deep.x') && totalsOf(r.f).missingHe === 0 && totalsOf(r.f).missingEn === 0;
  });

  // ---- rule 4: locales are read exactly or the tool stops
  t('r4 a spread in a locale stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'const o = {}; export default { ...o, a: { b: "x" } };' }));
  t('r4 a syntax error in a locale stops the tool', () => throwsTool({ [`${L}/en.jsx`]: 'export default { a: { b: "x" }, };; }' }));
  t('r4 an unsupported expression in a locale stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'const x = "q"; export default { a: { b: x } };' }));
  t('r4 a duplicate key stops the tool', () => throwsTool({ [`${L}/he.jsx`]: 'export default { a: { b: "x", b: "y" } };' }));
  t('r4 a key defined in a fragment and the main file stops the tool', () => throwsTool({ [`${L}/he/f.js`]: 'export default { a: { b: "dup" } };' }));
  t('r4 a clean fragment is read', () => totalsFor({ [`${L}/he/f.js`]: 'export default { frag: { k: "כן" } };', [`${L}/en/f.js`]: 'export default { frag: { k: "Yes" } };', 'src/pages/F.jsx': 'export default () => <p>{t("frag.k")}</p>;' }).missingHe === 0);
  t('r4 a bare prefix of a nested key is not a text', () => one('<p>{t("nested")}{t("nested.deep")}</p>').missingHe === 2);

  // ---- punctuation
  t('punct "!שלום" flagged', () => problemOf('!שלום') !== null);
  t('punct a Hebrew value ending with an opening quote flagged', () => problemOf('שלום "') !== null && problemOf('שלום (') !== null);
  t('punct a clean Hebrew value, and a Latin-only value, are not flagged', () => problemOf('שלום!') === null && problemOf('!Hello') === null);
  const PF = (v) => ({ [`${L}/he/f.js`]: `export default { frag: { bad: ${JSON.stringify(v)}, good: "שלום!" } };` });
  t('punct is found in a fragment and ratcheted like the rest', () => {
    const cur = scanMap(PF('!שלום')); const none = scanMap({});
    return totalsOf(cur.files).punct === 1 && !G(cur, none).ok && G(cur, cur).ok;
  });
  t('punct changing one bad value into another bad value at the same key FAILS', () => !G(scanMap(PF('?שלום')), scanMap(PF('!שלום'))).ok);
  t('punct the allow list suppresses a finding (and without it the finding exists)', () => withProject(PF('!שלום'), (d) => Object.keys(scanPunctuation(d, []).files).length === 1 && Object.keys(scanPunctuation(d, [{ key: 'frag.bad', reason: 'x' }]).files).length === 0));

  // ---- the workflow
  const GOOD = [
    '# This check stops accidents, not a determined author.', 'name: Language check', 'on:', '  pull_request:', '    branches: [main]', '  push:', '    branches: [main]', 'permissions:', '  contents: read',
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
  t('r5 push to every branch FAILS', () => lintWorkflow(GOOD.replace(/ {2}push:\n {4}branches: \[main\]/, '  push:')).length > 0);
  t('r5 a workflow that claims more than "stops accidents" FAILS the lint', () => lintWorkflow(GOOD.replace('stops accidents, not a determined author', 'is a security boundary')).length > 0);
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

  const { files, hashes, stats } = scanAll(ROOT);
  const totals = totalsOf(files);
  const exists = BASELINE_PATH && fs.existsSync(BASELINE_PATH);
  const fileExists = (f) => fs.existsSync(path.join(ROOT, f));
  const ref = opt('--base-ref');
  const renames = ref ? getRenames(ROOT, ref) : new Map();

  if (flag('--update-baseline')) {
    let old = null;
    if (exists) {
      try { old = parseBaseline(fs.readFileSync(BASELINE_PATH, 'utf8'), BASELINE_PATH); } catch (e) {
        if (!(e instanceof ToolError) || !/is not version/.test(e.message)) throw e;
        console.log('note: the existing baseline has an older format; replacing it');
      }
    }
    const d = old ? diffIdentities(strip(files), old.files, { curHashes: hashes, baseHashes: old.fileHashes, renames, exists: fileExists }) : { added: [] };
    if (d.added.length && !flag('--force')) {
      console.error(`refusing to add ${d.added.length} finding(s) to the baseline; fix them or pass --force:`);
      for (const a of d.added) console.error(`  ${a.measure}  ${a.file}  ${describe(a.measure, a.sig, a.p)}`);
      return 1;
    }
    fs.writeFileSync(BASELINE_PATH, serialize(strip(files), totals, hashes));
    console.log(`baseline written: ${path.relative(ROOT, BASELINE_PATH)}`);
    console.log(`totals: ${JSON.stringify(totals)}  scanned: ${stats.filesScanned} files`);
    return 0;
  }

  if (!exists) throw new ToolError(`baseline not found: ${BASELINE_PATH}. Create it with --update-baseline.`);
  const baseline = parseBaseline(fs.readFileSync(BASELINE_PATH, 'utf8'), BASELINE_PATH);
  let baseOfBase = null; let baseOfBaseHashes = {};
  if (ref) {
    const b = readBaselineAt(ROOT, ref);
    if (b) { baseOfBase = b.files; baseOfBaseHashes = b.fileHashes; } else console.log(`note: no comparable baseline at ${ref}: first introduction, base comparison skipped`);
  }
  const g = gate({
    cur: strip(files), base: baseline.files, curHashes: hashes, baseHashes: baseline.fileHashes, baseOfBase, baseOfBaseHashes, renames, exists: fileExists, override: process.env.I18N_BASELINE_OVERRIDE === '1',
  });
  console.log(`scanned ${stats.filesScanned} files (out of scope, counted not read: ui ${stats.outOfScope.ui}, tests ${stats.outOfScope.test}; unread copy candidates in objects/arrays: ${stats.unreadCopy})`);
  console.log(`totals now: ${JSON.stringify(totals)}`);
  const yi = [...stats.yiMissing].sort();
  console.log(`Yiddish (reported, never a failure): ${yi.length} key(s) used in code have no Yiddish text${yi.length ? `; first: ${yi.slice(0, 8).join(', ')}${yi.length > 8 ? ', ...' : ''} (all: node scripts/i18n-audit.mjs --yi)` : ''}`);
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
