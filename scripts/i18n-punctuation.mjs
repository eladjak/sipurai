#!/usr/bin/env node
/**
 * i18n-punctuation.mjs - Hebrew and Yiddish strings whose punctuation sits on the wrong side (contract I-02).
 *
 * A Hebrew string typed in a left-to-right editor often comes out reversed: "!ברוכים הבאים" instead of
 * "ברוכים הבאים!". This scans every Hebrew and Yiddish locale value (he.jsx, yi.jsx and their fragment
 * files) and flags a string that contains a Hebrew letter and either
 *   - STARTS with  ! ? . , : ;   (after trimming spaces), or
 *   - ENDS with an opening quote or bracket   "  „  «  (  [
 *
 *   node scripts/i18n-punctuation.mjs        print every flagged value: key, file, value
 *
 * Existing cases are recorded in scripts/i18n-baseline.json (measure "punct") by scripts/i18n-check.mjs,
 * so they do not fail but a NEW one does. A deliberate case goes into ALLOW below with a one-line reason.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToolError, loadLocale, hashOf, normText } from './i18n-audit.mjs';

/** { file, key, reason } - a value that looks wrong but is intended. Keep each reason to one line. */
export const ALLOW = [
  // { file: 'src/components/i18n/locales/he.jsx', key: 'example.key', reason: 'quotes a literal user input that ends with a quote' },
];

const HEB = /[֐-׿]/;
const START_BAD = /^[!?.,:;]/;
const END_BAD = /["„«(\[]$/;

export function problemOf(value) {
  const strings = Array.isArray(value) ? value.filter((x) => typeof x === 'string') : (typeof value === 'string' ? [value] : []);
  for (const s of strings) {
    if (!HEB.test(s)) continue;
    const t = s.trim();
    if (START_BAD.test(t)) return { kind: 'starts-with-punctuation', value: s };
    if (END_BAD.test(t)) return { kind: 'ends-with-opening-quote-or-bracket', value: s };
  }
  return null;
}

/** Same shape as the audit's findings: { file: { punct: { key: { n, lines, p } } } } plus a readable list. */
export function scanPunctuation(root) {
  const files = {};
  const list = [];
  for (const lang of ['he', 'yi']) {
    for (const [key, { value, file }] of loadLocale(root, lang)) {
      const bad = problemOf(value);
      if (!bad) continue;
      if (ALLOW.some((a) => a.key === key && (!a.file || a.file === file))) continue;
      ((files[file] ||= {}).punct ||= {})[key] = { n: 1, lines: [0], p: normText(bad.value).slice(0, 40) };
      list.push({ key, file, kind: bad.kind, value: bad.value });
    }
  }
  return { files, list, hashOf };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const rootArg = process.argv.indexOf('--root');
    const root = path.resolve(rootArg >= 0 ? process.argv[rootArg + 1] : path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
    const { list } = scanPunctuation(root);
    for (const b of list) console.log(`${b.key}\n  ${b.file}\n  ${b.kind}: ${JSON.stringify(b.value)}`);
    console.log(`${list.length} flagged value(s)`);
  } catch (e) {
    if (e instanceof ToolError) { console.error(`i18n-punctuation: ${e.message}`); process.exit(2); }
    throw e;
  }
}
