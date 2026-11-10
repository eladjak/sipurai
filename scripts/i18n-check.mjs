#!/usr/bin/env node
/**
 * i18n-check.mjs - the language gate (contract I-02).
 *
 * It counts, per source file, the things that make the app speak the wrong language, and compares the
 * counts with scripts/i18n-baseline.json. It only lets things get better:
 *
 *   node scripts/i18n-check.mjs                     exit 1 if ANY file's count went up, or a file that
 *                                                   is not in the baseline has a non-zero count
 *   node scripts/i18n-check.mjs --update-baseline   rewrite the baseline; refuses to raise a number or
 *                                                   add a file unless you also pass --force
 *   node scripts/i18n-check.mjs --fixture           run only the control fixtures
 *
 * Exit codes: 0 pass, 1 regression found, 2 the tool itself cannot be trusted (control fixture failed,
 * baseline missing/unreadable, locale file unreadable, parser missing). Fail closed: 2 is never "ok".
 *
 * Measures (per file):
 *   ternary    language ternaries with literal strings: isHebrew ? "שלום" : "Hello"
 *   hebText    Hebrew text written directly in JSX
 *   hebProp    Hebrew in placeholder/title/aria-label/alt/label/description/subtitle/helperText
 *   enText     English (2+ words) written directly in JSX
 *   enProp     English (2+ words) in those same props
 *   enAria     English aria-label (any Latin word of 3+ letters, no Hebrew)
 *   missingHe  t("key") calls whose key does not exist in the Hebrew locale
 *   missingEn  t("key") calls whose key does not exist in the English locale
 *   parseError the file could not be parsed (so it could not be counted: never silently skipped)
 *
 * Method follows the audit (docs/ux-overhaul/tools/i18n-audit.mjs): Babel AST, no regex-only counting.
 * Locale text is read from src/components/i18n/locales/{he,en}.jsx plus the fragment files
 * locales/{he,en}/*.js (contract I-01 merges them at run time, so they count as existing keys).
 *
 * Parser: @babel/parser and @babel/traverse are not direct dependencies of the app; they are installed
 * (pinned by package-lock.json) through the lint and build tooling. This script uses those copies and
 * stops with exit 2 if they are not there.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(opt('--root') || path.join(HERE, '..'));
const BASELINE_PATH = path.resolve(opt('--baseline') || path.join(HERE, 'i18n-baseline.json'));

export const MEASURES = ['ternary', 'hebText', 'hebProp', 'enText', 'enProp', 'enAria', 'missingHe', 'missingEn', 'parseError'];

const die = (msg) => { console.error(`i18n-check: ${msg}`); process.exit(2); };

let parser;
let traverse;
try {
  const req = createRequire(path.join(HERE, '..', 'package.json'));
  parser = req('@babel/parser');
  const tr = req('@babel/traverse');
  traverse = tr.default || tr;
} catch (e) {
  die(`cannot load @babel/parser / @babel/traverse (${e.code || e.message}). Run "npm ci" first.`);
}

const HEB = /[֐-׿]/;
const LAT3 = /[A-Za-z]{3,}/;
const ENW = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/; // 2+ Latin words separated by whitespace (excludes domains, emails)
const PROPS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'description', 'subtitle', 'helperText']);
const parse = (code, file) => parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true, sourceFilename: file });

// ---------- locale loading (structural evaluation of `export default {...}`) ----------
function evalObj(node, file) {
  switch (node.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': return node.value;
    case 'NullLiteral': return null;
    case 'TemplateLiteral': return node.quasis.map((q) => q.value.cooked).join('${}');
    case 'ArrayExpression': return node.elements.map((e) => (e ? evalObj(e, file) : null));
    case 'ObjectExpression': {
      const o = {};
      for (const p of node.properties) {
        if (p.type !== 'ObjectProperty') continue;
        const k = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        o[k] = evalObj(p.value, file);
      }
      return o;
    }
    default: return `<<${node.type}>>`;
  }
}
function loadLocale(file) {
  let ast;
  try { ast = parse(fs.readFileSync(file, 'utf8'), file); } catch (e) { die(`cannot read locale ${file}: ${e.message}`); }
  for (const n of ast.program.body) if (n.type === 'ExportDefaultDeclaration') return evalObj(n.declaration, file);
  return die(`no "export default" in locale ${file}`);
}
function flatten(o, pre = '', out = new Set()) {
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out.add(key);
  }
  return out;
}
function localeKeys(root, lang) {
  const dir = path.join(root, 'src/components/i18n/locales');
  const keys = flatten(loadLocale(path.join(dir, `${lang}.jsx`)));
  const frag = path.join(dir, lang);
  if (fs.existsSync(frag)) {
    for (const f of fs.readdirSync(frag).filter((x) => x.endsWith('.js')).sort()) {
      for (const k of flatten(loadLocale(path.join(frag, f)))) keys.add(k);
    }
  }
  // a key that is only a prefix of other keys ("a.b" when "a.b.c" exists) counts as present, as in the audit
  const prefixes = new Set();
  for (const k of keys) { let i = k.indexOf('.'); while (i !== -1) { prefixes.add(k.slice(0, i)); i = k.indexOf('.', i + 1); } }
  return { has: (k) => keys.has(k) || prefixes.has(k), size: keys.size };
}

// ---------- scanning ----------
function walk(dir, skip) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skip(p, true)) r = r.concat(walk(p, skip)); }
    else if (/\.(jsx|js)$/.test(e.name) && !skip(p, false)) r.push(p);
  }
  return r;
}

/** returns { files: { rel: { measure: { n, lines[] } } }, distinct: { he:Set, en:Set }, filesScanned } */
export function scan(root) {
  const he = localeKeys(root, 'he');
  const en = localeKeys(root, 'en');
  const sep = '[\\\\/]';
  const files = walk(path.join(root, 'src'), (p, isDir) => (isDir
    ? new RegExp(`${sep}(locales|__tests__|test|tests)$`).test(p) || new RegExp(`${sep}src${sep}components${sep}ui$`).test(p)
    : /\.test\.|\.spec\./.test(p))).sort();
  const out = {};
  const distinct = { he: new Set(), en: new Set() };
  for (const f of files) {
    const rel = path.relative(root, f).split(path.sep).join('/');
    const rec = {};
    const hit = (measure, line) => { (rec[measure] ||= { n: 0, lines: [] }); rec[measure].n++; rec[measure].lines.push(line); };
    let ast;
    const src = fs.readFileSync(f, 'utf8');
    try { ast = parse(src, f); } catch { hit('parseError', 0); out[rel] = rec; continue; }
    // errorRecovery keeps going after a syntax error; a half-parsed file cannot be counted reliably
    if (ast.errors && ast.errors.length) hit('parseError', (ast.errors[0].loc && ast.errors[0].loc.line) || 0);
    const add = (kind, node, text) => {
      const isH = HEB.test(text);
      const isE = !isH && ENW.test(text);
      if (isH) hit(`heb${kind}`, node.loc.start.line); else if (isE) hit(`en${kind}`, node.loc.start.line);
    };
    traverse(ast, {
      CallExpression(p) {
        const c = p.node.callee;
        if (c.type === 'Identifier' && c.name === 't' && p.node.arguments[0]) {
          const a = p.node.arguments[0];
          const k = a.type === 'StringLiteral' ? a.value : (a.type === 'TemplateLiteral' && a.expressions.length === 0 ? a.quasis[0].value.cooked : null);
          if (k) {
            if (!he.has(k)) { hit('missingHe', p.node.loc.start.line); distinct.he.add(k); }
            if (!en.has(k)) { hit('missingEn', p.node.loc.start.line); distinct.en.add(k); }
          }
        }
      },
      JSXText(p) {
        const t = p.node.value.replace(/\s+/g, ' ').trim();
        if (t && !/^[\s{}()\-–—.,:;|/&*+•·\d]+$/.test(t)) add('Text', p.node, t);
      },
      JSXAttribute(p) {
        const n = p.node.name.name;
        if (!PROPS.has(n) || !p.node.value) return;
        const v = p.node.value;
        const lit = v.type === 'StringLiteral' ? v : (v.type === 'JSXExpressionContainer' && v.expression.type === 'StringLiteral' ? v.expression : null);
        if (!lit) return;
        add('Prop', p.node, lit.value);
        if (n === 'aria-label' && !HEB.test(lit.value) && LAT3.test(lit.value)) hit('enAria', p.node.loc.start.line);
      },
      ConditionalExpression(p) {
        const { test, consequent: c, alternate: a } = p.node;
        const ts = src.slice(test.start, test.end);
        if (/\b(isHebrew|isRTL|isRtl|isYiddish|isEnglish)\b|language\s*[!=]==?\s*['"](hebrew|english|yiddish)['"]|lang\s*[!=]==?\s*['"](he|en|yi)['"]/.test(ts)
          && (c.type === 'StringLiteral' || a.type === 'StringLiteral')) {
          const lit = [c, a].filter((x) => x.type === 'StringLiteral').map((x) => x.value);
          if (lit.some((s) => HEB.test(s) || /^[A-Z][a-z]{2,}([ ,.'!?][A-Za-z]+)*[.!?]?$/.test(s))) hit('ternary', p.node.loc.start.line);
        }
      },
    });
    out[rel] = rec;
  }
  return { files: out, distinct, filesScanned: files.length };
}

// ---------- comparison ----------
const countOf = (rec, m) => (rec && rec[m] ? rec[m].n : 0);

/** current: scan().files ; baseline: { files: { rel: { measure: n } } }. Returns the list of regressions. */
export function compare(current, baseline) {
  const bad = [];
  for (const [file, rec] of Object.entries(current)) {
    const base = (baseline.files && baseline.files[file]) || null;
    for (const m of MEASURES) {
      const cur = countOf(rec, m);
      const was = base && Number.isFinite(base[m]) ? base[m] : 0;
      if (cur > was) bad.push({ file, measure: m, was, now: cur, isNewFile: !base, lines: rec[m].lines });
    }
  }
  return bad;
}

export function toBaseline(scanResult) {
  const files = {};
  const totals = Object.fromEntries(MEASURES.map((m) => [m, 0]));
  for (const file of Object.keys(scanResult.files).sort()) {
    const rec = scanResult.files[file];
    const row = {};
    for (const m of MEASURES) { const n = countOf(rec, m); if (n) { row[m] = n; totals[m] += n; } }
    if (Object.keys(row).length) files[file] = row;
  }
  return {
    note: 'Generated by scripts/i18n-check.mjs. Counts may only go down. Lower them with: node scripts/i18n-check.mjs --update-baseline',
    measures: MEASURES,
    totals,
    distinctMissingKeys: { he: scanResult.distinct.he.size, en: scanResult.distinct.en.size },
    files,
  };
}

// ---------- control fixtures (must pass before any number is trusted) ----------
function runFixtures() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-i18nfx-'));
  const w = (p, c) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), c); };
  w('src/components/i18n/locales/he.jsx', 'export default { a: { b: "שלום" } };');
  w('src/components/i18n/locales/en.jsx', 'export default { a: { b: "Hello" } };');
  w('src/components/i18n/locales/he/area.js', 'export default { frag: { k: "כן" } };');
  w('src/components/i18n/locales/en/area.js', 'export default { frag: { k: "Yes" } };');
  w('src/pages/Fx.jsx', 'export default function Fx(){ const {t,isHebrew}=useI18n(); return <div><p>שלום עולם</p><p>Hello brave world</p><span>{t("missing.key")}</span><span>{t("a.b")}</span><span>{t("frag.k")}</span><b>{isHebrew ? "כן" : "Yes"}</b><i aria-label="Close" title="שלום"/></div>; }');
  w('src/pages/Broken.jsx', 'export default function ( { return <div ;');
  let r;
  try { r = scan(d); } finally { fs.rmSync(d, { recursive: true, force: true }); }
  const fx = r.files['src/pages/Fx.jsx'] || {};
  const checks = {
    hebrewJsxText_counted: countOf(fx, 'hebText') === 1,
    englishJsxText_counted: countOf(fx, 'enText') === 1,
    hebrewProp_counted: countOf(fx, 'hebProp') === 1,
    englishAria_counted: countOf(fx, 'enAria') === 1,
    ternary_counted: countOf(fx, 'ternary') === 1,
    missingKey_detected_he_and_en: countOf(fx, 'missingHe') === 1 && countOf(fx, 'missingEn') === 1,
    existingKey_and_fragmentKey_not_flagged: r.distinct.he.size === 1 && r.distinct.he.has('missing.key'),
    unparsableFile_not_skipped_silently: countOf(r.files['src/pages/Broken.jsx'], 'parseError') >= 1,
  };
  // comparison control: the gate must be red for a rise and for a new dirty file, green for a drop
  const base = toBaseline(r);
  const raise = JSON.parse(JSON.stringify(r.files));
  raise['src/pages/Fx.jsx'].hebText = { n: 2, lines: [1, 2] };
  const newFile = JSON.parse(JSON.stringify(r.files));
  newFile['src/pages/New.jsx'] = { ternary: { n: 1, lines: [3] } };
  const drop = JSON.parse(JSON.stringify(r.files));
  drop['src/pages/Fx.jsx'].hebText = { n: 0, lines: [] };
  checks.compare_same_is_green = compare(r.files, base).length === 0;
  checks.compare_rise_is_red = compare(raise, base).length === 1;
  checks.compare_new_dirty_file_is_red = compare(newFile, base).some((x) => x.file === 'src/pages/New.jsx' && x.isNewFile);
  checks.compare_drop_is_green = compare(drop, base).length === 0;
  return { checks, pass: Object.values(checks).every(Boolean) };
}

// ---------- main ----------
function main() {
  const fixture = runFixtures();
  console.log(`control fixtures: ${fixture.pass ? 'pass' : 'FAIL'} (${Object.keys(fixture.checks).length} checks)`);
  if (!fixture.pass) {
    console.error(JSON.stringify(fixture.checks, null, 1));
    die('control fixture failed; refusing to report numbers.');
  }
  if (flag('--fixture')) return 0;

  const res = scan(ROOT);
  const current = toBaseline(res);
  const exists = fs.existsSync(BASELINE_PATH);

  if (flag('--update-baseline')) {
    if (exists) {
      let old;
      try { old = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch (e) { die(`baseline unreadable: ${e.message}`); }
      const rises = compare(res.files, old);
      if (rises.length && !flag('--force')) {
        console.error(`refusing to raise the baseline (${rises.length} rise(s)); fix them or pass --force:`);
        for (const b of rises) console.error(`  ${b.file}  ${b.measure}  ${b.was} -> ${b.now}`);
        return 1;
      }
    }
    fs.writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 1)}\n`);
    console.log(`baseline written: ${path.relative(ROOT, BASELINE_PATH)}`);
    console.log(`totals: ${JSON.stringify(current.totals)}  distinct missing keys: ${JSON.stringify(current.distinctMissingKeys)}  files with findings: ${Object.keys(current.files).length}  scanned: ${res.filesScanned}`);
    return 0;
  }

  if (!exists) die(`baseline not found: ${BASELINE_PATH}. Create it with --update-baseline.`);
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')); } catch (e) { die(`baseline unreadable: ${e.message}`); }
  if (!baseline || typeof baseline.files !== 'object' || !baseline.files) die('baseline has no "files" object.');

  const bad = compare(res.files, baseline);
  const was = baseline.totals || {};
  console.log(`scanned ${res.filesScanned} files`);
  console.log(`totals now:      ${JSON.stringify(current.totals)}`);
  console.log(`totals baseline: ${JSON.stringify(was)}`);
  if (bad.length) {
    console.error(`\nFAIL: the language check found ${bad.length} place(s) that got worse:\n`);
    for (const b of bad) {
      console.error(`  ${b.file}  [${b.measure}]  ${b.isNewFile ? 'new file' : `${b.was} -> ${b.now}`}  lines: ${b.lines.join(', ')}`);
    }
    console.error('\nUse t("...") with keys in the Hebrew and English locale files instead of writing text or language ternaries in the component.');
    return 1;
  }
  const better = MEASURES.filter((m) => (current.totals[m] || 0) < (was[m] || 0));
  console.log(`OK: nothing got worse.${better.length ? ` Improved: ${better.join(', ')}. Lock it in with: node scripts/i18n-check.mjs --update-baseline` : ''}`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
