#!/usr/bin/env node
// WCAG 2.x contrast check for the Sipurai design tokens (contract P1-02).
//
//   node scripts/check-contrast.mjs [path/to/sp-tokens.css]
//   node scripts/check-contrast.mjs --self-test
//
// This checker does NOT emulate the CSS cascade. Instead it ENFORCES A
// RESTRICTED FORMAT of sp-tokens.css and fails on anything outside it, so the
// value it reads is, by construction, the value the browser uses:
//
//   (a) exactly one base rule, selector list `.sp-shell, :root[data-sp-shell]`,
//       declaring each --sp-* token exactly once;
//   (b) --sp-* tokens may be set elsewhere ONLY inside an allowlisted scope
//       (SCOPES below: an @media block containing one rule with the same
//       selector list), each scope declaring a token at most once, each scope
//       at most once. Base plus every combination of scopes is checked, so
//       overlapping media queries cannot hide a failure;
//   (c) no !important on a token;
//   (d) colour tokens are literal #rrggbb or #rrggbbaa (no var(), no functions);
//       other tokens may use var() but are not part of the contrast check;
//   (e) a pair that names an undeclared token fails; every violation is
//       reported with its line number.
//
// Thresholds follow WCAG exactly: large text = at least 24px regular or at
// least 18.66px bold (3:1, as is non-text); anything smaller needs 4.5:1.
// A foreground colour with alpha is composited over its background; a
// background with alpha is refused.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export function isLarge(px, weight) {
  return px >= 24 || (px >= 18.66 && weight >= 700);
}

// [foreground, background, use]; use = { px, weight } or "icon" (non-text, 3:1).
export const PAIRS = [
  ["ink-900", "paper", { px: 16, weight: 400 }],
  ["ink-900", "card", { px: 16, weight: 400 }],
  ["ink-600", "paper", { px: 16, weight: 400 }],
  ["ink-600", "card", { px: 16, weight: 400 }],
  ["ink-500", "paper", { px: 13, weight: 400 }],
  ["ink-500", "card", { px: 13, weight: 400 }],
  // ink-400: icons, disabled, and large text ONLY (24px regular / 18.66px bold).
  ["ink-400", "paper", "icon"],
  ["ink-400", "card", "icon"],
  ["ink-400", "paper", { px: 24, weight: 400 }],
  ["ink-400", "paper", { px: 18.66, weight: 700 }],
  ["on-night", "night-800", { px: 16, weight: 400 }],
  ["on-night", "night-900", { px: 16, weight: 400 }],
  ["on-night-muted", "night-800", { px: 16, weight: 400 }],
  ["on-night-muted", "night-900", { px: 16, weight: 400 }],
  ["card", "violet-600", { px: 16, weight: 600 }], // white text on the primary action
  ["night-900", "gold-400", { px: 16, weight: 600 }],
  ["danger", "danger-50", { px: 15, weight: 400 }],
  ["success", "success-50", { px: 15, weight: 400 }],
];

// ---- the restricted format --------------------------------------------------
const BASE_SELECTOR = ".sp-shell, :root[data-sp-shell]";
// The only places a token may be re-set besides the base rule.
export const SCOPES = {
  dark: "@media (prefers-color-scheme: dark)",
  "more-contrast": "@media (prefers-contrast: more)",
};
const SCOPE_BY_AT = new Map(Object.entries(SCOPES).map(([k, v]) => [v, k]));

const norm = (s) => s.replace(/\s+/g, " ").trim();

// Comments become spaces (newlines kept) so line numbers stay right.
function blank(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// Parse into { errors:[{line,msg}], base:Map, scopes:Map(name->Map) }.
// Each map value: { value, line }.
export function parseTokensFile(css) {
  const text = blank(css);
  const errors = [];
  const lineAt = (pos) => text.slice(0, pos).split("\n").length;
  const err = (pos, msg) => errors.push({ line: lineAt(pos), msg });
  const base = new Map();
  const scopes = new Map();
  let baseRules = 0;

  const declsOf = (body, bodyStart) => {
    const out = [];
    let off = 0;
    for (const part of body.split(";")) {
      const m = part.match(/^(\s*)(--sp-[a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (m) {
        const pos = bodyStart + off + m[1].length;
        const important = /!important\s*$/i.test(m[3]);
        out.push({ name: m[2].slice(5), value: m[3].replace(/\s*!important\s*$/i, ""), important, pos });
      }
      off += part.length + 1;
    }
    return out;
  };

  const readRule = (prelude, preludePos, body, bodyStart, scopeName) => {
    const decls = declsOf(body, bodyStart);
    if (!decls.length) return;
    const sel = norm(prelude);
    if (sel !== BASE_SELECTOR) {
      for (const d of decls) err(d.pos, `--sp-${d.name} is set in rule "${sel}", which is not the base selector list "${BASE_SELECTOR}"`);
      return;
    }
    const target = scopeName ? scopes.get(scopeName) : base;
    if (scopeName === null) baseRules++;
    if (scopeName === null && baseRules > 1) err(preludePos, "second base rule: there must be exactly one");
    for (const d of decls) {
      if (d.important) err(d.pos, `--sp-${d.name} uses !important`);
      if (target.has(d.name)) err(d.pos, `--sp-${d.name} is declared more than once${scopeName ? ` in scope "${scopeName}"` : ""}`);
      else target.set(d.name, { value: d.value, line: lineAt(d.pos) });
    }
  };

  const walk = (src, srcStart, atRule) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i);
      if (open < 0) break;
      let depth = 1, j = open + 1;
      while (j < src.length && depth) {
        if (src[j] === "{") depth++;
        else if (src[j] === "}") depth--;
        j++;
      }
      const prelude = src.slice(i, open);
      const preludePos = srcStart + i + (prelude.length - prelude.trimStart().length);
      const body = src.slice(open + 1, j - 1);
      const bodyStart = srcStart + open + 1;
      const head = norm(prelude);
      if (head.startsWith("@")) {
        if (/--sp-[a-z0-9-]+\s*:/.test(body) || /\{/.test(body)) {
          const name = SCOPE_BY_AT.get(head);
          const hasToken = /--sp-[a-z0-9-]+\s*:/.test(body);
          if (hasToken && !name) err(preludePos, `tokens are set inside unknown scope "${head}" (allowed: ${Object.values(SCOPES).join(", ")})`);
          else if (name) {
            if (scopes.has(name)) err(preludePos, `scope "${name}" appears more than once`);
            else {
              scopes.set(name, new Map());
              // inside the scope: exactly one rule with the base selector list
              let k = 0, rules = 0;
              while (k < body.length) {
                const o2 = body.indexOf("{", k);
                if (o2 < 0) break;
                let d2 = 1, e2 = o2 + 1;
                while (e2 < body.length && d2) {
                  if (body[e2] === "{") d2++;
                  else if (body[e2] === "}") d2--;
                  e2++;
                }
                rules++;
                if (rules > 1) err(bodyStart + k, `scope "${name}" has more than one rule`);
                else readRule(body.slice(k, o2), bodyStart + k, body.slice(o2 + 1, e2 - 1), bodyStart + o2 + 1, name);
                k = e2;
              }
            }
          }
        }
      } else {
        readRule(prelude, preludePos, body, bodyStart, null);
      }
      i = j;
    }
  };
  walk(text, 0, null);
  if (baseRules === 0) errors.push({ line: 1, msg: "no base rule found" });
  return { errors, base, scopes };
}

function parseColorLiteral(v) {
  const m = v.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/);
  if (!m) return null;
  const n = (i) => parseInt(m[1].slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
}

function channel(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function composite(fg, bg) {
  const mix = (f, b) => Math.round(f * fg.a + b * (1 - fg.a));
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 };
}

export function ratio(fg, bg) {
  if (bg.a < 1) throw new Error("background colour has alpha: refused (make it opaque)");
  const f = fg.a < 1 ? composite(fg, bg) : fg;
  const [hi, lo] = [luminance(f), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Every non-empty combination of scopes, applied in file order over the base.
function combos(names) {
  const out = [[]];
  for (const n of names) out.push(...out.map((c) => [...c, n]));
  return out;
}

export function run(css, pairs = PAIRS) {
  const parsed = parseTokensFile(css);
  const rows = [];
  let failed = 0;
  const fail = (row) => {
    failed++;
    rows.push({ ok: false, ratio: NaN, fg: "-", bg: "-", scope: "-", ...row });
  };
  for (const e of parsed.errors) fail({ note: `line ${e.line}: ${e.msg}` });

  const colourNames = new Set(pairs.flatMap(([a, b]) => [a, b]));
  const all = [["base", parsed.base], ...[...parsed.scopes].map(([n, m]) => [n, m])];
  for (const [label, m] of all)
    for (const [name, { value, line }] of m)
      if (colourNames.has(name) && !parseColorLiteral(value))
        fail({ note: `line ${line}: colour token --sp-${name} must be a literal #rrggbb or #rrggbbaa, found "${value}"` });
      else if (value.startsWith("#") && !parseColorLiteral(value))
        fail({ note: `line ${line}: --sp-${name} is a malformed hex colour "${value}" (${label})` });

  if (parsed.errors.length) return { rows, failed }; // do not measure an invalid file

  const scopeNames = [...parsed.scopes.keys()];
  for (const combo of combos(scopeNames)) {
    const eff = new Map(parsed.base);
    for (const n of combo) for (const [k, v] of parsed.scopes.get(n)) eff.set(k, v);
    const label = combo.length ? combo.join("+") : "base";
    for (const [fg, bg, use] of pairs) {
      const row = { fg, bg, use, scope: label, ratio: NaN, ok: false };
      const f = eff.get(fg), b = eff.get(bg);
      if (!f || !b) row.note = `token --sp-${!f ? fg : bg} is not declared`;
      else {
        const fc = parseColorLiteral(f.value), bc = parseColorLiteral(b.value);
        if (!fc || !bc) row.note = "colour is not a literal hex";
        else
          try {
            row.ratio = ratio(fc, bc);
            row.composited = fc.a < 1;
            row.need = use === "icon" || isLarge(use.px, use.weight) ? 3 : 4.5;
            row.ok = row.ratio >= row.need;
          } catch (e) {
            row.note = e.message;
          }
      }
      if (!row.ok) failed++;
      rows.push(row);
    }
  }
  return { rows, failed };
}

function useLabel(u) {
  return u === "icon" ? "icon / non-text" : `${u.px}px ${u.weight >= 700 ? "bold" : u.weight}`;
}

function selfTest() {
  const base = readFileSync(join(here, "..", "src", "styles", "sp-tokens.css"), "utf8");
  const cases = [];
  const t = (name, ok) => cases.push([name, !!ok]);
  const P16 = (fg, bg = "paper") => [[fg, bg, { px: 16, weight: 400 }]];
  const swap = (css, name, val) => css.replace(new RegExp("(--sp-" + name + ":\\s*)[^;]+"), (_, p) => p + val);
  const inject = (css, decl) => css.replace("\n}\n", "\n" + decl + "\n}\n");
  const msg = (r) => r.rows.filter((x) => !x.ok && x.note).map((x) => x.note).join(" | ");
  const rejected = (r, re) => r.failed >= 1 && re.test(msg(r)) && /line \d+/.test(msg(r));
  const SEL = ".sp-shell,\n:root[data-sp-shell]";

  t("shipped file passes", run(base).failed === 0);
  const parsed = parseTokensFile(base);
  t("shipped file: no format errors, base only (no scopes today)", parsed.errors.length === 0 && parsed.scopes.size === 0);

  // (a) one base rule, each token once
  t("(a) pass: tokens declared once", run(swap(base, "ink-900", "#232323"), P16("ink-900")).failed === 0);
  t("(a) FAIL: duplicate token in base", rejected(run(inject(base, "  --sp-ink-900: #000000;"), P16("ink-900")), /declared more than once/));
  t("(a) FAIL: second base rule", rejected(run(base + "\n" + SEL + " { --sp-extra: 1px; }\n", P16("ink-900")), /second base rule/));
  t("(a) FAIL: token set in a differently-ordered selector list", rejected(run(base + "\n:root[data-sp-shell], .sp-shell { --sp-ink-900: #000000; }\n", P16("ink-900")), /not the base selector list/));
  // Codex round-3 example 1: specificity between the two selectors
  const ex1 = ".sp-shell, :root[data-sp-shell] { --sp-ink-900: #000000; --sp-paper: #ffffff; }\n:root[data-sp-shell] { --sp-ink-900: #cccccc; }\n.sp-shell { --sp-ink-900: #000000; }\n";
  t("(a) Codex example 1 (specificity trick) is REJECTED as a format violation", rejected(run(ex1, P16("ink-900")), /not the base selector list/));

  // (b) other rules only inside an allowlisted scope, each token at most once
  const darkOk = base + "\n@media (prefers-color-scheme: dark) {\n  " + SEL + " {\n    --sp-paper: #1e0b3a;\n    --sp-ink-900: #fef3c7;\n  }\n}\n";
  t("(b) pass: an allowlisted dark scope that keeps contrast (base+dark both measured)", run(darkOk, P16("ink-900")).failed === 0 && run(darkOk, P16("ink-900")).rows.length === 2);
  const darkBad = base + "\n@media (prefers-color-scheme: dark) {\n  " + SEL + " {\n    --sp-ink-900: #bbbbbb;\n  }\n}\n";
  const rdb = run(darkBad, P16("ink-900"));
  t("(b) FAIL: scope that breaks contrast fails only in that scope", rdb.rows.some((x) => x.scope === "base" && x.ok) && rdb.rows.some((x) => x.scope === "dark" && !x.ok));
  t("(b) FAIL: unknown scope", rejected(run(base + "\n@media (min-width: 600px) {\n  " + SEL + " { --sp-ink-900: #555555; }\n}\n", P16("ink-900")), /unknown scope/));
  t("(b) FAIL: token set in a bare non-base rule", rejected(run(base + "\n.card { --sp-ink-900: #cccccc; }\n", P16("ink-900")), /not the base selector list/));
  t("(b) FAIL: duplicate token inside a scope", rejected(run(base + "\n@media (prefers-color-scheme: dark) {\n  " + SEL + " {\n    --sp-paper: #111111;\n    --sp-paper: #222222;\n  }\n}\n", P16("ink-900")), /more than once in scope "dark"/));
  t("(b) FAIL: same scope twice", rejected(run(darkOk + "\n@media (prefers-color-scheme: dark) {\n  " + SEL + " { --sp-paper: #111111; }\n}\n", P16("ink-900")), /appears more than once/));
  // Codex round-3 example 2: two overlapping scopes that fail only together
  const both = base.replace("--sp-ink-900: #231942", "--sp-ink-900: #000000").replace("--sp-paper: #fffdf8", "--sp-paper: #ffffff")
    + "\n@media (prefers-contrast: more) {\n  " + SEL + " { --sp-ink-900: #555555; }\n}\n@media (prefers-color-scheme: dark) {\n  " + SEL + " { --sp-paper: #aaaaaa; }\n}\n";
  const rb = run(both, [["ink-900", "paper", { px: 16, weight: 400 }]]);
  t("(b) Codex example 2 (two scopes pass alone, fail together): combination is MEASURED and FAILS",
    rb.rows.some((x) => x.scope === "more-contrast" && x.ok) && rb.rows.some((x) => x.scope === "dark" && x.ok) &&
    rb.rows.some((x) => x.scope === "more-contrast+dark" && !x.ok));

  // (c) no !important
  t("(c) FAIL: !important on a token", rejected(run(swap(base, "ink-900", "#231942 !important"), P16("ink-900")), /!important/));

  // (d) literal colours only
  t("(d) pass: #rrggbbaa literal is allowed and composited", run(swap(base, "ink-900", "#23194280"), P16("ink-900")).rows[0].composited === true);
  t("(d) FAIL: colour token via var()", rejected(run(swap(base, "ink-900", "var(--sp-ink-600)"), P16("ink-900")), /must be a literal/));
  t("(d) FAIL: colour token via rgb()", rejected(run(swap(base, "ink-900", "rgb(35 25 66)"), P16("ink-900")), /must be a literal/));
  t("(d) FAIL: short #rgb colour token", rejected(run(swap(base, "ink-900", "#234"), P16("ink-900")), /must be a literal/));
  t("(d) pass: a NON-colour token may use var()", run(swap(base, "dur-fast", "var(--sp-dur)"), P16("ink-900")).failed === 0);
  t("(d) FAIL: background with alpha is refused", run(swap(base, "paper", "#fffdf880"), P16("ink-900")).failed >= 1);
  t("(d) FAIL: transparent fg is composited, so it fails instead of reading as black", run(swap(base, "ink-900", "#00000000"), P16("ink-900")).failed === 1);

  // (e) undeclared token, comment decoy, line numbers
  t("(e) FAIL: pair names an undeclared token", run(base.replace(/--sp-ink-900:[^;]+;/, ""), P16("ink-900")).failed >= 1);
  t("(e) pass: a commented-out declaration is not a declaration", run(base.replace("--sp-ink-900: #231942;", "--sp-ink-900: #231942; /* --sp-ink-900: #000000; */"), P16("ink-900")).failed === 0);
  const lineCheck = run(inject(base, "  --sp-ink-900: #000000;"), P16("ink-900"));
  const dupLine = /line (\d+)/.exec(msg(lineCheck));
  const expected = base.split("\n").findIndex((l) => l.includes("--sp-ink-900")) + 1;
  t("(e) violation names the right line (the later duplicate, after the first at " + expected + ")", dupLine && Number(dupLine[1]) > expected);

  // WCAG large-text rule
  t("ink-400 as 18px regular text FAILS", run(base, [["ink-400", "paper", { px: 18, weight: 400 }]]).failed === 1);
  t("ink-400 as 20px bold passes (18.66px+ bold)", run(base, [["ink-400", "paper", { px: 20, weight: 700 }]]).failed === 0);
  t("ink-400 as 18px bold FAILS (below 18.66)", run(base, [["ink-400", "paper", { px: 18, weight: 700 }]]).failed === 1);
  t("ink-400 as 24px regular passes", run(base, [["ink-400", "paper", { px: 24, weight: 400 }]]).failed === 0);
  t("isLarge boundaries", !isLarge(23.9, 400) && isLarge(24, 400) && !isLarge(18.6, 700) && isLarge(18.66, 700));

  let bad = 0;
  for (const [name, ok] of cases) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) bad++;
  }
  console.log(`\n${cases.length} self-tests, ${bad} failed`);
  process.exit(bad ? 1 : 0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === "--self-test") selfTest();
  const file = process.argv[2] ?? join(here, "..", "src", "styles", "sp-tokens.css");
  let css;
  try {
    css = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  const { rows, failed } = run(css);
  for (const r of rows) {
    const label = r.note && r.fg === "-" ? "format" : `${r.fg} on ${r.bg}`.padEnd(30) + (r.scope === "base" ? "" : ` [${r.scope}]`);
    const val = Number.isNaN(r.ratio) ? "  n/a" : r.ratio.toFixed(2).padStart(5) + ":1";
    const note = r.note ?? `${useLabel(r.use)} (needs ${r.need}:1)${r.composited ? " [alpha composited]" : ""}`;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label} ${val}  ${note}`);
  }
  console.log(`\n${rows.length} checks, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
