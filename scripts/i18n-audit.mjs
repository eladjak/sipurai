#!/usr/bin/env node
/**
 * i18n-audit.mjs - finds where the app does not speak the user's language (contract I-02).
 *
 * Adapted from the planning tool docs/ux-overhaul/tools/i18n-audit.mjs. It now lives in the repository,
 * imports Babel from the repo's own node_modules, keeps a control fixture, and returns every finding
 * with a stable IDENTITY (measure + file + signature) so scripts/i18n-check.mjs can tell a new problem
 * from an old one even when the counts are equal.
 *
 *   node scripts/i18n-audit.mjs            print the report (counts, top files, what is out of scope)
 *   node scripts/i18n-audit.mjs --json     print every finding as JSON
 *   node scripts/i18n-audit.mjs --fixture  run only the control fixture
 *
 * Measures (a finding is one occurrence; its signature is what makes it "the same one" later):
 *   ternary     language ternary with literal strings (isHebrew ? "שלום" : "Hello")   sig: hash of the literals
 *   hebText     Hebrew text written in JSX (child text, {"..."}, {`...`}, {a ? "x" : "y"})  sig: hash of the text
 *   hebProp     Hebrew in a text-bearing prop (title, placeholder, label, alt, message...)   sig: hash of the text
 *   enText      Latin-letter text in JSX, including ONE word ("Save")                         sig: hash of the text
 *   enProp      Latin-letter text in a text-bearing prop                                      sig: hash of the text
 *   enAria      Latin-letter aria-label / aria-description ...                                sig: hash of the text
 *   missingHe   t("key") / x.t("key") whose key is not a text in the Hebrew locale          sig: the key
 *   missingEn   same for the English locale                                                 sig: the key
 *   wrongParent a missing key that exists under another parent (welcome.title vs onboarding.welcome.title)  sig: the key
 *   dynamicKey  t(variable) / t(`a.${x}`): cannot be verified, so it is counted, not ignored  sig: hash of the argument
 *   parseError  the file could not be parsed completely, so it could not be counted           sig: "parse"
 *
 * Languages: Hebrew and English are REQUIRED. A t("key") must resolve to a non-empty STRING in both
 * (null, false, 0, a function, an array, a whitespace-only string all count as missing, as t() would
 * return the key). Yiddish is hidden from users by an owner decision, so Yiddish coverage is REPORTED
 * (a count and the list of keys, every run) but never fails the check.
 *
 * Also read: a string constant that is rendered ({label} where const label = "Create a story"), aliases of
 * t (const tr = t; const { t: tt } = useI18n()), a string passed as the second argument of t(), strings
 * given to toast / alert / confirm / prompt, and "text " + name concatenation inside JSX.
 *
 * Still OUT OF SCOPE (never silently: counted and printed every run): copy that sits in objects/arrays/
 * constants and is rendered through a loop or another function (printed as "unread copy candidates"),
 * src/components/ui/** (design-system primitives), tests, and the locale files. Whether a Yiddish value is
 * really translated (not copied English) is a review question, not something this script can decide.
 *
 * LIMITS, said plainly: this check stops accidents, not a determined author. The pull request that is being
 * judged also carries this script, its baseline and the workflow, so its author can change all three.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));

export class ToolError extends Error {}

export const MEASURES = ['ternary', 'hebText', 'hebProp', 'enText', 'enProp', 'enAria', 'missingHe', 'missingEn', 'wrongParent', 'dynamicKey', 'parseError', 'punct'];

let babel = null;
export function loadBabel() {
  if (babel) return babel;
  try {
    const req = createRequire(path.join(HERE, '..', 'package.json'));
    const tr = req('@babel/traverse');
    babel = { parser: req('@babel/parser'), traverse: tr.default || tr };
  } catch (e) {
    throw new ToolError(`cannot load @babel/parser and @babel/traverse (${e.code || e.message}). They are devDependencies: run "npm ci" first.`);
  }
  return babel;
}

const HEB = /[֐-׿]/;
const LAT2 = /[A-Za-z]{2,}/;
const LAT3 = /[A-Za-z]{3,}/;
const ENW = /[A-Za-z]{2,}\s+[A-Za-z]{2,}/; // the old audit's "two English words" rule, kept only for the legacy numbers

// Latin strings that are not translatable copy (brand names, units, file types). Exact match, case-sensitive.
export const EN_ALLOW = new Set(['Sipurai', 'AI', 'PDF', 'Google', 'Facebook', 'WhatsApp', 'Pinterest', 'Twitter', 'Instagram', 'TikTok', 'LinkedIn', 'Email', 'EPUB', 'PNG', 'JPG', 'JPEG', 'GIF', 'SVG', 'OK', 'px', 'MB', 'KB', 'GB', 'HD', 'URL', 'ID', 'FAQ', 'VAT', 'XP', 'cm']);

const TEXT_PROPS = new Set(['title', 'placeholder', 'alt', 'label', 'description', 'subtitle', 'helperText', 'tooltip', 'message', 'text', 'heading', 'caption', 'hint', 'errorMessage', 'emptyText', 'buttonText']);
const ARIA_PROPS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext']);

export const normText = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
export const hashOf = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// ---------------------------------------------------------------------------------------------
// Locales: strict structural evaluation of `export default {...}`. Anything we cannot evaluate
// exactly stops the tool (exit 2) with file and line, instead of being guessed.
// ---------------------------------------------------------------------------------------------
class Opaque {} // a function value: the key exists but t() would not return text
const OPAQUE = new Opaque();

function parseStrict(code, file, plugins = ['jsx']) {
  const { parser } = loadBabel();
  let ast;
  try { ast = parser.parse(code, { sourceType: 'module', plugins, errorRecovery: true, sourceFilename: file }); } catch (e) {
    throw new ToolError(`locale file does not parse: ${file}: ${e.message}`);
  }
  if (ast.errors && ast.errors.length) {
    const e = ast.errors[0];
    throw new ToolError(`locale file has syntax errors (recovered): ${file}:${e.loc ? e.loc.line : '?'}: ${e.message}`);
  }
  return ast;
}

function evalLocale(node, file, keyPath) {
  const where = (n) => `${file}:${n.loc ? n.loc.start.line : '?'}`;
  switch (node.type) {
    case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral': return node.value;
    case 'NullLiteral': return null;
    case 'TemplateLiteral': return node.quasis.map((q) => q.value.cooked).join('${}');
    case 'BinaryExpression': {
      if (node.operator === '+') {
        const a = evalLocale(node.left, file, keyPath);
        const b = evalLocale(node.right, file, keyPath);
        if (typeof a === 'string' && typeof b === 'string') return a + b;
      }
      throw new ToolError(`unsupported expression in locale (${node.type}) at ${where(node)} under "${keyPath}"`);
    }
    case 'ArrowFunctionExpression': case 'FunctionExpression': return OPAQUE;
    case 'ArrayExpression': return node.elements.map((e) => {
      if (!e || e.type === 'SpreadElement') throw new ToolError(`unsupported array element in locale at ${where(node)} under "${keyPath}"`);
      return evalLocale(e, file, keyPath);
    });
    case 'ObjectExpression': {
      const o = Object.create(null);
      for (const p of node.properties) {
        if (p.type === 'SpreadElement') throw new ToolError(`spread in locale object at ${where(p)} under "${keyPath || '(root)'}": the keys it adds cannot be known`);
        if (p.computed) throw new ToolError(`computed key in locale object at ${where(p)} under "${keyPath || '(root)'}"`);
        const k = p.key.type === 'Identifier' ? p.key.name : (p.key.type === 'StringLiteral' || p.key.type === 'NumericLiteral') ? String(p.key.value) : null;
        if (k === null) throw new ToolError(`unsupported key type ${p.key.type} at ${where(p)}`);
        if (k in o) throw new ToolError(`duplicate key "${keyPath ? `${keyPath}.` : ''}${k}" at ${where(p)}`);
        o[k] = p.type === 'ObjectMethod' ? OPAQUE : evalLocale(p.value, file, keyPath ? `${keyPath}.${k}` : k);
      }
      return o;
    }
    default: throw new ToolError(`unsupported expression in locale (${node.type}) at ${where(node)} under "${keyPath || '(root)'}"`);
  }
}

function readLocaleFile(file) {
  const ast = parseStrict(fs.readFileSync(file, 'utf8'), file);
  const exp = ast.program.body.filter((n) => n.type === 'ExportDefaultDeclaration');
  if (exp.length !== 1) throw new ToolError(`locale file must have exactly one "export default": ${file}`);
  const obj = evalLocale(exp[0].declaration, file, '');
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new ToolError(`locale default export is not an object: ${file}`);
  return obj;
}

function flattenInto(o, file, pre, out) {
  for (const [k, v] of Object.entries(o)) {
    const key = pre ? `${pre}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Opaque)) flattenInto(v, file, key, out);
    else {
      if (out.has(key)) throw new ToolError(`key "${key}" is defined twice: ${out.get(key).file} and ${file}`);
      out.set(key, { value: v, file });
    }
  }
}

/** All leaf texts of one language: main file plus fragment files locales/<lang>/*.js. Map key -> {value, file}. */
export function loadLocale(root, lang) {
  const dir = path.join(root, 'src/components/i18n/locales');
  const out = new Map();
  const main = path.join(dir, `${lang}.jsx`);
  if (!fs.existsSync(main)) throw new ToolError(`locale file not found: ${main}`);
  flattenInto(readLocaleFile(main), path.relative(root, main).split(path.sep).join('/'), '', out);
  const frag = path.join(dir, lang);
  if (fs.existsSync(frag)) {
    for (const f of fs.readdirSync(frag).filter((x) => x.endsWith('.js')).sort()) {
      flattenInto(readLocaleFile(path.join(frag, f)), path.relative(root, path.join(frag, f)).split(path.sep).join('/'), '', out);
    }
  }
  return out;
}

/** What t() would find: a leaf with a non-empty value. A prefix of a nested key is NOT a text. */
function localeView(leaves) {
  const present = new Set();
  const suffixes = new Set();
  const prefixes = new Set();
  for (const [k, { value }] of leaves) {
    if (typeof value === 'string' && value.trim() !== '') present.add(k); // anything else is not a text
    let i = k.indexOf('.');
    while (i !== -1) { suffixes.add(k.slice(i + 1)); prefixes.add(k.slice(0, i)); i = k.indexOf('.', i + 1); }
  }
  return { has: (k) => present.has(k), hasSuffix: (k) => suffixes.has(k), hasPrefix: (k) => prefixes.has(k) };
}

// ---------------------------------------------------------------------------------------------
// Source scan
// ---------------------------------------------------------------------------------------------
function walk(dir, visit) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, visit); else visit(p);
  }
}

function classify(rel) {
  const parts = rel.split('/');
  if (!/\.(jsx?|tsx?)$/.test(rel) || /\.d\.ts$/.test(rel)) return 'ignore';
  if (parts.includes('locales')) return 'locale';
  if (parts.includes('__tests__') || parts.includes('test') || parts.includes('tests') || /\.(test|spec)\./.test(rel)) return 'test';
  if (rel.startsWith('src/components/ui/')) return 'ui';
  return 'scan';
}

/** String pieces a JSX expression would put on screen: literals, templates, branches of ?: and &&/||/?? */
function stringsOf(node, out = []) {
  if (!node) return out;
  switch (node.type) {
    case 'StringLiteral': out.push({ value: node.value, node }); break;
    case 'TemplateLiteral': out.push({ value: node.quasis.map((q) => q.value.cooked).join('${}'), node }); break;
    case 'ConditionalExpression': stringsOf(node.consequent, out); stringsOf(node.alternate, out); break;
    case 'LogicalExpression': stringsOf(node.left, out); stringsOf(node.right, out); break;
    case 'ParenthesizedExpression': stringsOf(node.expression, out); break;
    case 'BinaryExpression': if (node.operator === '+') { stringsOf(node.left, out); stringsOf(node.right, out); } break;
    default: break;
  }
  return out;
}

// Copy only if some Latin word is not a brand/unit token (every word allowed = not translatable copy).
const onlyAllowedTokens = (t) => (t.match(/[A-Za-z]+/g) || []).every((w) => EN_ALLOW.has(w));
function langOf(text) {
  if (HEB.test(text)) return 'heb';
  if (LAT2.test(text) && !onlyAllowedTokens(text)) return 'en';
  return null;
}

/**
 * Returns { files: { rel: { measure: { sig: { n, lines[], p } } } }, hashes: { rel: contentHash }, stats }.
 * `hashes` has an entry for every file that has findings (used to recognise a pure file rename).
 */
export function scanProject(root) {
  const { parser, traverse } = loadBabel();
  const he = localeView(loadLocale(root, 'he'));
  const en = localeView(loadLocale(root, 'en'));
  const yi = localeView(loadLocale(root, 'yi'));
  const files = {};
  const hashes = {};
  const stats = {
    filesScanned: 0, outOfScope: { ui: 0, test: 0, locale: 0 }, distinctMissing: { he: new Set(), en: new Set(), heLegacyPrefix: new Set() },
    yiMissing: new Set(), unreadCopy: 0,
    legacy: { hebText: 0, hebProp: 0, enText: 0, enProp: 0, ternary: 0 },
  };
  const list = [];
  walk(path.join(root, 'src'), (p) => {
    const rel = path.relative(root, p).split(path.sep).join('/');
    const c = classify(rel);
    if (c === 'scan') list.push([p, rel]); else if (c !== 'ignore') stats.outOfScope[c] += 1;
  });
  list.sort((a, b) => (a[1] < b[1] ? -1 : 1));

  for (const [p, rel] of list) {
    stats.filesScanned += 1;
    const rec = {};
    const seen = new Set(); // string nodes already counted (a constant rendered twice is one finding)
    const hit = (measure, sig, line, preview) => {
      const m = (rec[measure] ||= {});
      const e = (m[sig] ||= { n: 0, lines: [], p: preview });
      e.n += 1; e.lines.push(line);
    };
    const src = fs.readFileSync(p, 'utf8');
    const ts = /\.tsx?$/.test(rel);
    const plugins = ts ? ['jsx', 'typescript'] : ['jsx'];
    let ast;
    try { ast = parser.parse(src, { sourceType: 'module', plugins, errorRecovery: true, sourceFilename: p }); } catch { hit('parseError', 'parse', 0, ''); files[rel] = rec; hashes[rel] = hashOf(src); continue; }
    if (ast.errors && ast.errors.length) hit('parseError', 'parse', (ast.errors[0].loc && ast.errors[0].loc.line) || 0, '');

    const text = (kind, node, value) => {
      if (seen.has(node.start)) return;
      const t = normText(value);
      if (!t || /^[\s${}()\-–—.,:;|/&*+•·\d!?'"“”‘’<>=%]+$/.test(t)) return;
      if (/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(t) || /^[\w-]+(\.[\w-]+)+$/.test(t)) return; // an e-mail address or a domain is not copy
      const lang = langOf(t);
      if (!lang) return;
      seen.add(node.start);
      hit(`${lang}${kind}`, hashOf(t), node.loc.start.line, t.slice(0, 40));
      if (lang === 'heb') stats.legacy[`heb${kind}`] += 1;
      else if (ENW.test(t)) stats.legacy[`en${kind}`] += 1;
    };
    // t aliases in this file: const tr = t;  const { t: tt } = useI18n();
    const tNames = new Set(['t']);
    traverse(ast, {
      VariableDeclarator(pp) {
        const { id, init } = pp.node;
        if (id.type === 'Identifier' && init && init.type === 'Identifier' && tNames.has(init.name)) tNames.add(id.name);
        if (id.type === 'ObjectPattern') {
          for (const pr of id.properties) {
            if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier' && pr.key.name === 't' && pr.value.type === 'Identifier') tNames.add(pr.value.name);
          }
        }
      },
    });
    const keyHit = (callNode, arg) => {
      if (!arg) return;
      const k = arg.type === 'StringLiteral' ? arg.value : (arg.type === 'TemplateLiteral' && arg.expressions.length === 0 ? arg.quasis[0].value.cooked : null);
      const line = callNode.loc.start.line;
      if (k === null || k === undefined) { hit('dynamicKey', hashOf(normText(src.slice(arg.start, arg.end))), line, normText(src.slice(arg.start, arg.end)).slice(0, 40)); return; }
      const missHe = !he.has(k);
      const missEn = !en.has(k);
      if (missHe) { hit('missingHe', k, line, k); stats.distinctMissing.he.add(k); if (!he.hasPrefix(k)) stats.distinctMissing.heLegacyPrefix.add(k); }
      if (missEn) { hit('missingEn', k, line, k); stats.distinctMissing.en.add(k); }
      if (!yi.has(k)) stats.yiMissing.add(k); // reported, never a finding: Yiddish is hidden from users
      if ((missHe || missEn) && (he.hasSuffix(k) || en.hasSuffix(k))) hit('wrongParent', k, line, k);
    };
    const isTCallee = (c) => (c.type === 'Identifier' && tNames.has(c.name))
      || ((c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') && !c.computed && c.property.type === 'Identifier' && c.property.name === 't');
    const NOTICE_FNS = ['success', 'error', 'info', 'warning', 'message', 'loading', 'alert', 'confirm', 'prompt'];
    const isNoticeCallee = (c) => (c.type === 'Identifier' && ['toast', 'alert', 'confirm', 'prompt'].includes(c.name))
      || (c.type === 'MemberExpression' && !c.computed && c.object.type === 'Identifier' && ['toast', 'window'].includes(c.object.name)
        && c.property.type === 'Identifier' && NOTICE_FNS.includes(c.property.name));
    const onCall = (pp) => {
      const n = pp.node;
      if (isTCallee(n.callee)) {
        keyHit(n, n.arguments[0]);
        const second = n.arguments[1]; // a fallback text: it would show instead of a missing translation
        if (second && (second.type === 'StringLiteral' || second.type === 'TemplateLiteral')) {
          for (const x of stringsOf(second)) text('Text', x.node, x.value);
        } else if (second && second.type === 'ObjectExpression') {
          for (const pr of second.properties) {
            if (pr.type === 'ObjectProperty' && pr.key.type === 'Identifier' && ['defaultValue', 'fallback', 'default'].includes(pr.key.name)) {
              for (const x of stringsOf(pr.value)) text('Text', x.node, x.value);
            }
          }
        }
      } else if (isNoticeCallee(n.callee) && n.arguments[0]) {
        for (const x of stringsOf(n.arguments[0])) text('Text', x.node, x.value);
      }
    };
    // what a JSX expression would show: literals, templates, ?: and &&/|| branches, "a " + b, and a constant
    const shown = (expr, scope) => {
      const out = [];
      const go = (e, depth) => {
        if (!e) return;
        if (e.type === 'Identifier') {
          if (depth > 0 || !scope) return;
          const b = scope.getBinding(e.name);
          if (b && b.constant && b.path.isVariableDeclarator() && b.path.node.init) go(b.path.node.init, 1);
          return;
        }
        stringsOf(e, out);
      };
      go(expr, 0);
      return out;
    };

    traverse(ast, {
      CallExpression: onCall,
      OptionalCallExpression: onCall,
      JSXText(path_) { text('Text', path_.node, path_.node.value); },
      JSXExpressionContainer(path_) {
        if (path_.parent.type === 'JSXAttribute') return; // handled by the attribute visitor
        for (const s of shown(path_.node.expression, path_.scope)) text('Text', s.node, s.value);
      },
      JSXAttribute(path_) {
        const n = path_.node.name.name;
        const isAria = ARIA_PROPS.has(n);
        if ((!TEXT_PROPS.has(n) && !isAria) || !path_.node.value) return;
        const v = path_.node.value;
        const pieces = v.type === 'StringLiteral' ? [{ value: v.value, node: v }] : (v.type === 'JSXExpressionContainer' ? shown(v.expression, path_.scope) : []);
        for (const s of pieces) {
          const t = normText(s.value);
          if (isAria && t && !HEB.test(t)) {
            if (LAT3.test(t) && !onlyAllowedTokens(t) && !seen.has(s.node.start)) { seen.add(s.node.start); hit('enAria', hashOf(t), s.node.loc.start.line, t.slice(0, 40)); }
          } else text('Prop', s.node, s.value);
        }
      },
      ConditionalExpression(path_) {
        const { test, consequent: c, alternate: a } = path_.node;
        const ts_ = src.slice(test.start, test.end);
        if (/\b(isHebrew|isRTL|isRtl|isYiddish|isEnglish)\b|language\s*[!=]==?\s*['"](hebrew|english|yiddish)['"]|lang\s*[!=]==?\s*['"](he|en|yi)['"]/.test(ts_)
          && (c.type === 'StringLiteral' || a.type === 'StringLiteral')) {
          const lit = [c, a].filter((x) => x.type === 'StringLiteral').map((x) => x.value);
          if (lit.some((s) => HEB.test(s) || /^[A-Z][a-z]{2,}([ ,.'!?][A-Za-z]+)*[.!?]?$/.test(s))) {
            hit('ternary', hashOf(lit.map(normText).join('\u0001')), path_.node.loc.start.line, lit.join(' | ').slice(0, 40));
            stats.legacy.ternary += 1;
          }
        }
      },
    });
    // copy that sits in objects/arrays and is rendered later: not read, but counted
    traverse(ast, {
      ObjectProperty(path_) {
        const k = path_.node.key.name || path_.node.key.value;
        const v = path_.node.value;
        if (!TEXT_PROPS.has(k) || v.type !== 'StringLiteral' || seen.has(v.start)) return;
        const t = normText(v.value);
        if (t && langOf(t)) stats.unreadCopy += 1;
      },
    });
    if (Object.keys(rec).length) { files[rel] = rec; hashes[rel] = hashOf(src); }
  }
  return { files, hashes, stats };
}

export function totalsOf(files) {
  const t = Object.fromEntries(MEASURES.map((m) => [m, 0]));
  for (const rec of Object.values(files)) for (const [m, sigs] of Object.entries(rec)) for (const e of Object.values(sigs)) t[m] += e.n;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Control fixture: must pass before any number is trusted.
// ---------------------------------------------------------------------------------------------
export function mkProject(map) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-i18nfx-'));
  for (const [p, c] of Object.entries(map)) { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), c); }
  return d;
}
export const rmProject = (d) => fs.rmSync(d, { recursive: true, force: true });

const LOC = 'src/components/i18n/locales';
export const BASE_LOCALES = {
  [`${LOC}/he.jsx`]: 'export default { a: { b: "שלום", copy: "Hello world" }, nested: { deep: { x: "כן" } } };',
  [`${LOC}/en.jsx`]: 'export default { a: { b: "Hello", copy: "Hello world" }, nested: { deep: { x: "Yes" } } };',
  [`${LOC}/yi.jsx`]: 'export default { a: { b: "שלום" } };',
};

export function runAuditControl() {
  const d = mkProject({
    ...BASE_LOCALES,
    [`${LOC}/he/area.js`]: 'export default { frag: { k: "כן" } };',
    [`${LOC}/en/area.js`]: 'export default { frag: { k: "Yes" } };',
    'src/pages/Fx.jsx': 'export default function Fx(){ const {t,isHebrew}=useI18n(); return <div><p>שלום עולם</p><p>Hello brave world</p><span>{t("missing.key")}</span><span>{t("a.b")}</span><span>{t("frag.k")}</span><b>{isHebrew ? "כן" : "Yes"}</b><i aria-label="Close" title="שלום"/></div>; }',
  });
  let r;
  try { r = scanProject(d); } finally { rmProject(d); }
  const tot = totalsOf({ x: r.files['src/pages/Fx.jsx'] || {} });
  const checks = {
    hebrewJsxText: tot.hebText === 2, englishJsxText: tot.enText === 2, hebrewProp: tot.hebProp === 1, englishAria: tot.enAria === 1, ternary: tot.ternary === 1,
    missingKey_he_and_en: tot.missingHe === 1 && tot.missingEn === 1,
    existingAndFragmentKeysNotFlagged: r.stats.distinctMissing.he.size === 1,
  };
  return { checks, pass: Object.values(checks).every(Boolean) };
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
function cli() {
  const args = process.argv.slice(2);
  const rootArg = args.indexOf('--root');
  const ROOT = path.resolve(rootArg >= 0 ? args[rootArg + 1] : path.join(HERE, '..'));
  const fx = runAuditControl();
  console.log(`control fixture: ${fx.pass ? 'pass' : 'FAIL'} ${JSON.stringify(fx.checks)}`);
  if (!fx.pass) { console.error('control fixture failed; refusing to report numbers.'); return 2; }
  if (args.includes('--fixture')) return 0;
  const { files, stats } = scanProject(ROOT);
  if (args.includes('--json')) { console.log(JSON.stringify(files, null, 1)); return 0; }
  const tot = totalsOf(files);
  const he = loadLocale(ROOT, 'he'); const en = loadLocale(ROOT, 'en'); const yi = loadLocale(ROOT, 'yi');
  console.log(`locale keys: he ${he.size}, en ${en.size}, yi ${yi.size}`);
  console.log(`scanned ${stats.filesScanned} files. Out of scope (counted, not read): ui ${stats.outOfScope.ui}, tests ${stats.outOfScope.test}, locales ${stats.outOfScope.locale}`);
  console.log(`findings: ${JSON.stringify(tot)}`);
  console.log(`distinct keys used but missing: he ${stats.distinctMissing.he.size} (${stats.distinctMissing.heLegacyPrefix.size} if a bare prefix of a nested key counted as present, as the first audit did), en ${stats.distinctMissing.en.size}`);
  console.log(`two-word subset (the first audit's rule, but it now also reads {"..."} children and ?: branches, so it is higher than its 56/26): ${JSON.stringify(stats.legacy)}`);
  const top = Object.entries(files).map(([f, rec]) => [f, Object.values(rec).reduce((a, s) => a + Object.values(s).reduce((x, e) => x + e.n, 0), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('top files:'); for (const [f, n] of top) console.log(`  ${String(n).padStart(4)}  ${f}`);
  console.log(`Yiddish (reported, never a failure): ${stats.yiMissing.size} key(s) used in code have no Yiddish text`);
  if (args.includes('--yi')) for (const k of [...stats.yiMissing].sort()) console.log(`  ${k}`); else console.log('  (list them: node scripts/i18n-audit.mjs --yi)');
  console.log(`Unread copy candidates (text-like props inside objects/arrays, not read): ${stats.unreadCopy}`);
  console.log('Not measured (out of scope): copy in objects/arrays rendered through loops or other functions, src/components/ui, tests, locales.');
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exit(cli()); } catch (e) { if (e instanceof ToolError) { console.error(`i18n-audit: ${e.message}`); process.exit(2); } throw e; }
}
