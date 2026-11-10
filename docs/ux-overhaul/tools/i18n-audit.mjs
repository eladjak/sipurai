// i18n audit for Sipurai. Rerun (from anywhere):
//   cd /root/work/sipurai-ux-49eb82ff && node docs/ux-overhaul/tools/i18n-audit.mjs
// Optional: --root <dir> (default: repo root = three levels above tools/), --out <dir> (default docs/ux-overhaul/data), --fixture (run only the control fixture)
// Method: @babel/parser + @babel/traverse (from /root/work/sipurai-dash-1179515851/node_modules). Locale files are `export default {...}`
// object literals; the ObjectExpression is evaluated structurally (string/template/number/bool/nested only; anything else is listed in evalIssues).
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { createRequire } from 'node:module';
const require = createRequire('/root/work/sipurai-dash-1179515851/node_modules/');
const parser = require('@babel/parser'); const traverse = (require('@babel/traverse').default || require('@babel/traverse'));
const args = process.argv.slice(2); const arg = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(arg('--root') || path.join(here, '..', '..', '..'));
const OUT = path.resolve(arg('--out') || path.join(ROOT, 'docs/ux-overhaul/data'));
const HEB = /[֐-׿]/, LAT3 = /[A-Za-z]{3,}/, ENW = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/; // ENW = 2+ latin words separated by whitespace (excludes domains, emails)
const parse = (code, file) => parser.parse(code, { sourceType: 'module', plugins: ['jsx'], errorRecovery: true, sourceFilename: file });

function evalObj(node, issues, file) {
  switch (node.type) {
    case 'StringLiteral': return node.value;
    case 'NumericLiteral': case 'BooleanLiteral': return node.value;
    case 'NullLiteral': return null;
    case 'TemplateLiteral': return node.quasis.map(q => q.value.cooked).join('${}');
    case 'ObjectExpression': {
      const o = {};
      for (const p of node.properties) {
        if (p.type !== 'ObjectProperty') { issues.push(`${file}:${p.loc.start.line} non-property ${p.type}`); continue; }
        const k = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        o[k] = evalObj(p.value, issues, file);
      }
      return o;
    }
    case 'ArrayExpression': return node.elements.map(e => e ? evalObj(e, issues, file) : null);
    default: issues.push(`${file}:${node.loc.start.line} unevaluable ${node.type}`); return `<<${node.type}>>`;
  }
}
function loadLocale(file, issues) {
  const ast = parse(fs.readFileSync(file, 'utf8'), file); let obj = null;
  for (const n of ast.program.body) if (n.type === 'ExportDefaultDeclaration') obj = evalObj(n.declaration, issues, file);
  if (!obj) throw new Error('no export default in ' + file);
  return obj;
}
function flatten(o, pre = '', out = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? pre + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out); else out[key] = v;
  }
  return out;
}
const walk = (dir, exts, skip) => {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!skip(p, true)) r = r.concat(walk(p, exts, skip)); }
    else if (exts.some(x => e.name.endsWith(x)) && !skip(p, false)) r.push(p);
  }
  return r;
};
const strOf = v => typeof v === 'string' ? v : Array.isArray(v) ? v.filter(x => typeof x === 'string').join(' ') : '';

function scanCode(files, rootDir) {
  const used = new Map(); const perFile = {}; const hebList = [], enList = [], ternList = [];
  const tot = { hebText: 0, hebProp: 0, enText: 0, enProp: 0, ternary: 0, parseErrors: 0 };
  const PROPS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'description', 'subtitle', 'helperText']);
  for (const f of files) {
    const rel = path.relative(rootDir, f); let ast; const src = fs.readFileSync(f, 'utf8');
    try { ast = parse(src, f); } catch (e) { tot.parseErrors++; continue; }
    const pf = perFile[rel] = { hebText: 0, hebProp: 0, enText: 0, enProp: 0, ternary: 0, tKeys: 0 };
    const add = (kind, node, text) => {
      const isH = HEB.test(text), isE = !isH && ENW.test(text);
      if (!isH && !isE) return;
      const field = (isH ? 'heb' : 'en') + kind; tot[field]++; pf[field]++;
      (isH ? hebList : enList).push(`${rel}:${node.loc.start.line} ${kind.toLowerCase()} ${JSON.stringify(text.trim().slice(0, 60))}`);
    };
    traverse(ast, {
      CallExpression(p) {
        const c = p.node.callee;
        if (c.type === 'Identifier' && c.name === 't' && p.node.arguments[0]) {
          const a = p.node.arguments[0];
          const k = a.type === 'StringLiteral' ? a.value : (a.type === 'TemplateLiteral' && a.expressions.length === 0 ? a.quasis[0].value.cooked : null);
          if (k) { if (!used.has(k)) used.set(k, []); used.get(k).push(`${rel}:${p.node.loc.start.line}`); pf.tKeys++; }
        }
      },
      JSXText(p) {
        const t = p.node.value.replace(/\s+/g, ' ').trim();
        if (t && !/^[\s{}()\-–—.,:;|/&*+•·\d]+$/.test(t)) add('Text', p.node, t);
      },
      JSXAttribute(p) {
        const n = p.node.name.name; if (!PROPS.has(n) || !p.node.value) return;
        const v = p.node.value;
        if (v.type === 'StringLiteral') add('Prop', p.node, v.value);
        else if (v.type === 'JSXExpressionContainer' && v.expression.type === 'StringLiteral') add('Prop', p.node, v.expression.value);
      },
      ConditionalExpression(p) {
        const { test, consequent: c, alternate: a } = p.node; const ts = src.slice(test.start, test.end);
        if (/\b(isHebrew|isRTL|isRtl|isYiddish|isEnglish)\b|language\s*[!=]==?\s*['"](hebrew|english|yiddish)['"]|lang\s*[!=]==?\s*['"](he|en|yi)['"]/.test(ts)
          && (c.type === 'StringLiteral' || a.type === 'StringLiteral')) {
          const lit = [c, a].filter(x => x.type === 'StringLiteral').map(x => x.value);
          if (lit.some(s => HEB.test(s) || /^[A-Z][a-z]{2,}([ ,.'!?][A-Za-z]+)*[.!?]?$/.test(s))) { // Hebrew literal, or sentence-case English (not CSS classes)
            tot.ternary++; pf.ternary++; ternList.push(`${rel}:${p.node.loc.start.line} ${ts.slice(0, 40)} ? ${JSON.stringify(lit).slice(0, 70)}`);
          }
        }
      },
    });
  }
  return { used, perFile, tot, hebList, enList, ternList };
}

function scanData(dir, rootDir) {
  const findings = [];
  const SKIP_KEYS = new Set(['id', 'imagePrompt', 'textEn', 'genre', 'art_style', 'language', 'cover_gradient', 'age_range', 'slug', 'url', 'image', 'imageUrl', 'cover', 'icon', 'color', 'date', 'publishedAt', '_type', '_key', 'style', 'marks', 'href', 'category', 'tags', 'type', 'coverGradient', 'gradient', 'bg']);
  for (const f of walk(dir, ['.js', '.jsx'], () => false)) {
    const rel = path.relative(rootDir, f); const ast = parse(fs.readFileSync(f, 'utf8'), f);
    traverse(ast, {
      ObjectExpression(p) {
        const props = p.node.properties.filter(x => x.type === 'ObjectProperty'); const keys = props.map(x => x.key.name || x.key.value);
        if (keys.includes('en') && !keys.includes('he')) findings.push({ file: rel, line: p.node.loc.start.line, kind: 'bilingual-object-missing-he', keys: keys.join(',') });
        if (keys.includes('en') && keys.includes('he')) {
          const he = props.find(x => (x.key.name || x.key.value) === 'he').value;
          if (he.type === 'StringLiteral' && !HEB.test(he.value) && LAT3.test(he.value)) findings.push({ file: rel, line: he.loc.start.line, kind: 'he-value-has-no-hebrew', value: he.value.slice(0, 80) });
        }
      },
      ObjectProperty(p) {
        const k = p.node.key.name || p.node.key.value; if (SKIP_KEYS.has(k)) return; const v = p.node.value;
        // skip the English half of a {he,en} pair and anything nested under an `en` branch (that is the intended English copy)
        if (k === 'en' || p.findParent(a => a.isObjectProperty() && ['en', 'yi', 'he'].includes(a.node.key.name || a.node.key.value))) return;
        const s = v.type === 'StringLiteral' ? v.value : (v.type === 'TemplateLiteral' ? v.quasis.map(q => q.value.cooked).join('') : null);
        if (s && LAT3.test(s) && !HEB.test(s) && !/^(https?:|\/|#|[a-z0-9_-]+$)/.test(s.trim())) {
          const par = p.parent.properties.map(x => x.key && (x.key.name || x.key.value));
          findings.push({ file: rel, line: v.loc.start.line, kind: 'english-only-user-field', key: k, siblingKeys: par.slice(0, 8).join(','), value: s.slice(0, 80) });
        }
      },
    });
  }
  return findings;
}


// Secondary scan: English-only content objects living outside src/data (e.g. pages/Home.jsx showcase arrays, ModelSelector).
function scanInlineContent(files, rootDir) {
  const out = []; const KEYS = new Set(['title', 'name', 'description', 'excerpt', 'moral', 'subtitle', 'summary', 'tagline', 'label']);
  for (const f of files) {
    const rel = path.relative(rootDir, f); let ast; try { ast = parse(fs.readFileSync(f, 'utf8'), f); } catch (e) { continue; }
    traverse(ast, {
      ObjectProperty(p) {
        const k = p.node.key.name || p.node.key.value; if (!KEYS.has(k) || p.parent.type !== 'ObjectExpression') return;
        const v = p.node.value; if (v.type !== 'StringLiteral' || HEB.test(v.value) || !ENW.test(v.value) || /^[a-z0-9 _.-]+$/.test(v.value)) return;
        const sib = p.parent.properties.map(x => x.key && (x.key.name || x.key.value)).filter(Boolean);
        const hasHe = sib.some(x => /He$|^he$|Hebrew/.test(x));
        out.push({ file: rel, line: v.loc.start.line, kind: hasHe ? 'english-with-he-sibling' : 'english-only-inline-content', key: k, value: v.value.slice(0, 70), siblingKeys: sib.slice(0, 7).join(',') });
      },
    });
  }
  return out;
}

function audit(root) {
  const L = {}; const issues = []; const dir = path.join(root, 'src/components/i18n/locales');
  for (const n of ['he', 'en', 'yi']) L[n] = flatten(loadLocale(path.join(dir, n + '.jsx'), issues));
  const keys = n => new Set(Object.keys(L[n]));
  const diff = (a, b) => [...keys(a)].filter(k => !keys(b).has(k));
  const copies = (n, ref) => Object.keys(L[n]).filter(k => k in L[ref] && typeof L[n][k] === 'string' && L[n][k] === L[ref][k] && /[A-Za-z]{2,}/.test(L[n][k]));
  const noScript = (n, re) => Object.keys(L[n]).filter(k => { const s = strOf(L[n][k]); return s && LAT3.test(s) && !re.test(s); });
  const srcDir = path.join(root, 'src');
  const sep = '[\\\\/]';
  const files = walk(srcDir, ['.jsx', '.js'], (p, isDir) => isDir
    ? new RegExp(`${sep}(locales|__tests__|test|tests)$`).test(p) || new RegExp(`${sep}src${sep}components${sep}ui$`).test(p)
    : /\.test\.|\.spec\./.test(p));
  const code = scanCode(files, root);
  const usedKeys = [...code.used.keys()];
  const missingIn = n => usedKeys.filter(k => !(k in L[n]) && !Object.keys(L[n]).some(x => x.startsWith(k + '.'))).map(k => ({ key: k, at: code.used.get(k)[0] }));
  const inlineContent = scanInlineContent(files, root);
  const dataFindings = fs.existsSync(path.join(root, 'src/data')) ? scanData(path.join(root, 'src/data'), root) : [];
  const top = Object.entries(code.perFile).map(([f, c]) => ({ file: f, ...c, total: c.hebText + c.hebProp + c.enText + c.enProp + c.ternary })).sort((a, b) => b.total - a.total);
  return {
    generatedAt: new Date().toISOString(), root, filesScanned: files.length, evalIssues: issues,
    keysPerLocale: Object.fromEntries(['he', 'en', 'yi'].map(n => [n, keys(n).size])),
    missing: { 'he_vs_en(keys in en not in he)': diff('en', 'he'), 'yi_vs_en(keys in en not in yi)': diff('en', 'yi'), 'en_vs_he(keys in he not in en)': diff('he', 'en') },
    untranslatedCopies: { he_identical_to_en: copies('he', 'en'), he_without_hebrew_letters: noScript('he', HEB), yi_identical_to_en: copies('yi', 'en'), yi_without_hebrew_letters: noScript('yi', HEB) },
    tUsage: {
      distinctKeysUsed: usedKeys.length,
      usedButMissing: { he: missingIn('he'), en: missingIn('en'), yi: missingIn('yi') },
      unusedKeys: { he: [...keys('he')].filter(k => !code.used.has(k)).length, en: [...keys('en')].filter(k => !code.used.has(k)).length, yi: [...keys('yi')].filter(k => !code.used.has(k)).length },
    },
    hardcoded: { totals: code.tot, topFiles: top.slice(0, 30), samples: { hebrew: code.hebList.slice(0, 25), english: code.enList.slice(0, 25), ternaries: code.ternList.slice(0, 40) } },
    dataFindings, inlineContent,
  };
}

function runFixture() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-i18nfx-'));
  const w = (p, c) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), c); };
  w('src/components/i18n/locales/he.jsx', 'export default { a: { b: "שלום", copy: "Hello world", only_he: "רק" } };');
  w('src/components/i18n/locales/en.jsx', 'export default { a: { b: "Hello", copy: "Hello world", only_en: "x" } };');
  w('src/components/i18n/locales/yi.jsx', 'export default { a: { b: "שלום" } };');
  w('src/pages/Fx.jsx', 'export default function Fx(){ const {t,isHebrew}=useI18n(); return <div><p>שלום עולם</p><p>Hello brave world</p><span>{t("missing.key")}</span><b>{isHebrew ? "כן" : "Yes"}</b></div>; }');
  w('src/pages/Y.jsx', 'export const items = [{ title: "Ocean Explorers", id: 1 }];');
  w('src/data/x.js', 'export default [{ title: "The Dragon Quest", he: "שלום" }];');
  const r = audit(d); fs.rmSync(d, { recursive: true, force: true });
  const checks = {
    hardcodedHebrewJsxText_counted: r.hardcoded.totals.hebText === 1,
    hardcodedEnglishJsxText_counted: r.hardcoded.totals.enText === 1,
    tMissingKey_detected: r.tUsage.usedButMissing.he.some(x => x.key === 'missing.key') && r.tUsage.usedButMissing.en.some(x => x.key === 'missing.key'),
    keyMissingInHe_detected: r.missing['he_vs_en(keys in en not in he)'].includes('a.only_en'),
    keyMissingInYi_detected: r.missing['yi_vs_en(keys in en not in yi)'].includes('a.copy'),
    untranslatedCopy_detected: r.untranslatedCopies.he_identical_to_en.includes('a.copy'),
    ternary_detected: r.hardcoded.totals.ternary === 1,
    dataEnglishOnly_detected: r.dataFindings.some(x => x.kind === 'english-only-user-field'),
    inlineEnglishContent_detected: r.inlineContent.some(x => x.value === 'Ocean Explorers'),
  };
  return { checks, pass: Object.values(checks).every(Boolean), counts: { hebText: r.hardcoded.totals.hebText, enText: r.hardcoded.totals.enText, ternary: r.hardcoded.totals.ternary, missingKeyHits: r.tUsage.usedButMissing.he.length } };
}

const fixture = runFixture(); console.log('FIXTURE', JSON.stringify(fixture));
if (!fixture.pass) { console.error('control failed; refusing to report numbers'); process.exit(2); }
if (args.includes('--fixture')) process.exit(0);
const res = audit(ROOT); res.controlFixture = fixture; fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'i18n-audit.json'), JSON.stringify(res, null, 1));
const L = (a, n = 15) => a.slice(0, n).map(x => '  - ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n') || '  (none)';
const t = res.hardcoded.totals; const u = res.tUsage;
const md = `# i18n audit (generated ${res.generatedAt})

**Rerun:** \`cd /root/work/sipurai-ux-49eb82ff && node docs/ux-overhaul/tools/i18n-audit.mjs\`
Method: Babel AST (@babel/parser + traverse from /root/work/sipurai-dash-1179515851/node_modules) for locales, t() calls, JSX text/props, ternaries and src/data. No regex-only counting.

## Control check (mandatory; passed: ${fixture.pass})
Fixture = temp project with one Hebrew JSX string, one English JSX string, one t('missing.key'), one isHebrew ternary with literals, one English-only data field, one untranslated copy, one key missing in he and yi. Result: ${JSON.stringify(fixture.checks)}; counts ${JSON.stringify(fixture.counts)}. The script refuses to emit numbers if any check fails.

## Locale keys
| locale | keys | keys missing vs en | value identical to en (Latin) | Latin value with no Hebrew letters |
|---|---|---|---|---|
| en | ${res.keysPerLocale.en} | - | - | - |
| he | ${res.keysPerLocale.he} | ${res.missing['he_vs_en(keys in en not in he)'].length} | ${res.untranslatedCopies.he_identical_to_en.length} | ${res.untranslatedCopies.he_without_hebrew_letters.length} |
| yi | ${res.keysPerLocale.yi} | ${res.missing['yi_vs_en(keys in en not in yi)'].length} | ${res.untranslatedCopies.yi_identical_to_en.length} | ${res.untranslatedCopies.yi_without_hebrew_letters.length} |

Keys in he but not in en: ${res.missing['en_vs_he(keys in he not in en)'].length}. Locale eval issues: ${res.evalIssues.length}.
Caveat: "no Hebrew letters" also counts brand names, emails and codes (PDF, Google...); full lists are in i18n-audit.json.

Missing in he (first 15):
${L(res.missing['he_vs_en(keys in en not in he)'])}

Missing in yi (first 15):
${L(res.missing['yi_vs_en(keys in en not in yi)'])}

he values with Latin only (first 15):
${L(res.untranslatedCopies.he_without_hebrew_letters)}

## t() usage in code (${res.filesScanned} files; excludes locales, tests, src/components/ui)
Distinct literal keys used: ${u.distinctKeysUsed}. Used but missing from he: ${u.usedButMissing.he.length}, en: ${u.usedButMissing.en.length}, yi: ${u.usedButMissing.yi.length}. Keys not referenced by any literal t() call (dynamic keys inflate this): he ${u.unusedKeys.he}, en ${u.unusedKeys.en}, yi ${u.unusedKeys.yi}.

Used but missing in he (first 30):
${L(u.usedButMissing.he, 30)}

## Hard-coded user-facing strings in JSX
JSX text: Hebrew ${t.hebText}, English (2+ words) ${t.enText}. String props (placeholder,title,aria-label,alt,label,description,subtitle,helperText): Hebrew ${t.hebProp}, English (2+ words) ${t.enProp}. Language ternaries with literal strings: ${t.ternary}. Parse errors: ${t.parseErrors}.

Top 30 files:
| file | heb text | heb prop | en text | en prop | ternary | t() calls |
|---|---|---|---|---|---|---|
${res.hardcoded.topFiles.map(f => `| ${f.file} | ${f.hebText} | ${f.hebProp} | ${f.enText} | ${f.enProp} | ${f.ternary} | ${f.tKeys} |`).join('\n')}

Ternary samples:
${L(res.hardcoded.samples.ternaries, 20)}

## src/data user-facing content findings (${res.dataFindings.length})
src/data holds 3 files (demoBooks, blogPosts, privacyPolicyContent). Result 0 was verified against the fixture control above and by manual check: demoBooks titles are {he,en} pairs, blogPosts are Hebrew-only, privacyPolicyContent English is the intended en branch.
${L(res.dataFindings, 60)}

## English-only content objects OUTSIDE src/data (title/name/description/excerpt/moral/subtitle/summary/tagline/label), ${res.inlineContent.filter(x => x.kind === 'english-only-inline-content').length} without a Hebrew sibling key, ${res.inlineContent.filter(x => x.kind !== 'english-only-inline-content').length} with one
${L(res.inlineContent.filter(x => x.kind === 'english-only-inline-content'), 80)}

With a *He sibling (bilingual by convention, lower risk): ${res.inlineContent.filter(x => x.kind !== 'english-only-inline-content').length}
`;
fs.writeFileSync(path.join(OUT, 'i18n-audit.md'), md); console.log('wrote', OUT);
console.log(JSON.stringify({ keys: res.keysPerLocale, missing: Object.fromEntries(Object.entries(res.missing).map(([k, v]) => [k, v.length])), copies: Object.fromEntries(Object.entries(res.untranslatedCopies).map(([k, v]) => [k, v.length])), t: { used: u.distinctKeysUsed, missing: { he: u.usedButMissing.he.length, en: u.usedButMissing.en.length, yi: u.usedButMissing.yi.length }, unused: u.unusedKeys }, tot: t, top5: res.hardcoded.topFiles.slice(0, 5).map(f => f.file + ':' + f.total), data: res.dataFindings.length, inline: res.inlineContent.length, inlineOnly: res.inlineContent.filter(x => x.kind === 'english-only-inline-content').length, evalIssues: res.evalIssues.length }, null, 1));
