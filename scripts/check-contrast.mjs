#!/usr/bin/env node
// WCAG 2.x contrast check for the Sipurai design tokens (contract P1-02).
//
//   node scripts/check-contrast.mjs [path/to/sp-tokens.css]
//   node scripts/check-contrast.mjs --self-test
//
// Prints the contrast ratio of every pair in PAIRS and exits 1 if any pair
// fails. Each pair declares the way it is USED (font size in px and weight);
// the threshold follows from that, exactly as WCAG defines it:
//   - "large text" = at least 24px regular, or at least 18.66px bold (700).
//     Large text needs 3:1. Non-text (icons, borders) also needs 3:1.
//   - everything smaller needs 4.5:1.
// A pair used below its declared size therefore fails. ink-400 reaches only
// ~3.7:1, so it may be used ONLY for icons/disabled states and for text of
// 24px+ regular or 18.66px+ bold. It must never carry 18px regular text.
//
// Colours with alpha (#rgba, #rrggbbaa) are never read as opaque: a
// foreground with alpha is composited over its declared background before
// measuring; a background with alpha is refused with an error.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Large text per WCAG: >= 24px regular, or >= 18.66px (14pt) at weight >= 700.
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

// ---- structural CSS parsing (what the browser would see) -------------------
// Comments are stripped; rules are read with brace matching, including nested
// @media / @supports blocks. Within a scope the LAST declaration wins
// (!important beats non-important). var(--sp-x[, fallback]) chains are
// resolved; an unresolved or cyclic var() is an error. Specificity between the
// two base selectors (.sp-shell and :root[data-sp-shell]) is treated as equal,
// i.e. pure source order, which is how the file is written.
const BASE_SELECTORS = new Set([".sp-shell", ":root[data-sp-shell]"]);

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseBlock(text, media, out) {
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim().replace(/^[;\s]+/, "");
    let depth = 1, j = open + 1;
    while (j < text.length && depth) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") depth--;
      j++;
    }
    const body = text.slice(open + 1, j - 1);
    if (/^@(media|supports|layer|container)\b/i.test(prelude)) {
      parseBlock(body, [...media, prelude.replace(/\s+/g, " ")], out);
    } else if (!prelude.startsWith("@")) {
      const decls = [];
      for (const part of body.split(";")) {
        const m = part.match(/^\s*(--sp-[a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/);
        if (!m) continue;
        const important = /!important\s*$/i.test(m[2]);
        decls.push({ name: m[1].slice(5), value: m[2].replace(/\s*!important\s*$/i, "").trim(), important });
      }
      if (decls.length)
        for (const sel of prelude.split(",").map((x) => x.trim().replace(/\s+/g, " ")))
          out.push({ selector: sel, media, decls });
    }
    i = j;
  }
}

// -> [{ name, vars }] one entry per scope: "base" plus every other context
// (an @media block or a non-base selector) that redefines --sp-* tokens,
// each laid over the base values. vars: name -> raw string value.
export function parseScopes(css) {
  const rules = [];
  parseBlock(stripComments(css), [], rules);
  const apply = (map, rule) => {
    for (const d of rule.decls) {
      const prev = map.get(d.name);
      if (prev && prev.important && !d.important) continue;
      map.set(d.name, { value: d.value, important: d.important });
    }
  };
  const base = new Map();
  for (const r of rules) if (!r.media.length && BASE_SELECTORS.has(r.selector)) apply(base, r);
  const scopes = [{ name: "base", raw: base }];
  const ctx = new Map();
  for (const r of rules) {
    if (!r.media.length && BASE_SELECTORS.has(r.selector)) continue;
    const key = [...r.media, r.selector].join(" | ");
    if (!ctx.has(key)) ctx.set(key, new Map(base));
    apply(ctx.get(key), r);
  }
  for (const [name, raw] of ctx) scopes.push({ name, raw });
  return scopes;
}

function parseColor(v) {
  let m = v.match(/^#([0-9a-fA-F]+)$/);
  if (m) {
    const h = m[1];
    if (![3, 4, 6, 8].includes(h.length)) throw new Error(`bad hex ${v}`);
    const x = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
    const n = (i) => parseInt(x.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: x.length === 8 ? n(6) / 255 : 1 };
  }
  m = v.match(/^rgba?\(\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*(?:[,/]\s*([\d.]+)(%?))?\s*\)$/i);
  if (m) {
    const c = (x, p) => Math.round(p ? (parseFloat(x) * 255) / 100 : parseFloat(x));
    const a = m[7] === undefined ? 1 : m[8] ? parseFloat(m[7]) / 100 : parseFloat(m[7]);
    return { r: c(m[1], m[2]), g: c(m[3], m[4]), b: c(m[5], m[6]), a };
  }
  throw new Error(`unsupported colour value "${v}"`);
}

// Resolve one token in a scope to { r,g,b,a }; throws on cycle / unresolved / unsupported.
export function resolveToken(raw, name, seen = []) {
  if (seen.includes(name)) throw new Error(`cyclic var(): ${[...seen, name].join(" -> ")}`);
  const entry = raw.get(name);
  if (!entry) throw new Error(`token --sp-${name} is not defined`);
  const m = entry.value.match(/^var\(\s*--sp-([a-z0-9-]+)\s*(?:,\s*([\s\S]+))?\)$/);
  if (m) {
    if (raw.has(m[1])) return resolveToken(raw, m[1], [...seen, name]);
    if (m[2]) return parseColor(m[2].trim());
    throw new Error(`unresolved var(--sp-${m[1]}) in --sp-${name}`);
  }
  return parseColor(entry.value);
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

export function run(css, pairs = PAIRS) {
  const rows = [];
  let failed = 0;
  let scopes;
  try {
    scopes = parseScopes(css);
  } catch (e) {
    return { rows: [{ fg: "-", bg: "-", scope: "-", ratio: NaN, ok: false, note: e.message }], failed: 1 };
  }
  for (const sc of scopes) {
    for (const [fg, bg, use] of pairs) {
      const row = { fg, bg, use, scope: sc.name, ratio: NaN, ok: false };
      try {
        const f = resolveToken(sc.raw, fg), b = resolveToken(sc.raw, bg);
        row.ratio = ratio(f, b);
        row.composited = f.a < 1;
        row.need = use === "icon" || isLarge(use.px, use.weight) ? 3 : 4.5;
        row.ok = row.ratio >= row.need;
      } catch (e) {
        row.note = e.message;
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
  const swap = (css, name, val) => css.replace(new RegExp("(--sp-" + name + ":\s*)[^;]+"), (_, p) => p + val);
  const inject = (css, decl) => css.replace("\n}\n", "\n" + decl + "\n}\n");
  const failedWith = (r, re) => r.failed >= 1 && r.rows.some((x) => !x.ok && re.test(x.note ?? ""));

  t("shipped tokens pass in every scope", run(base).failed === 0);
  const scopeCount = parseScopes(base).length;
  t(`scopes in the shipped file: ${scopeCount} (base only is expected today)`, scopeCount >= 1);

  // WCAG large-text rule
  t("ink-400 as 18px regular text FAILS", run(base, [["ink-400", "paper", { px: 18, weight: 400 }]]).failed === 1);
  t("ink-400 as 20px bold passes (18.66px+ bold)", run(base, [["ink-400", "paper", { px: 20, weight: 700 }]]).failed === 0);
  t("ink-400 as 18px bold FAILS (below 18.66)", run(base, [["ink-400", "paper", { px: 18, weight: 700 }]]).failed === 1);
  t("ink-400 as 24px regular passes", run(base, [["ink-400", "paper", { px: 24, weight: 400 }]]).failed === 0);
  t("isLarge boundaries", !isLarge(23.9, 400) && isLarge(24, 400) && !isLarge(18.6, 700) && isLarge(18.66, 700));

  // alpha
  const r1 = run(swap(base, "ink-900", "#00000000"), P16("ink-900"));
  t("transparent fg is composited (invisible => FAILS)", r1.failed === 1 && r1.rows[0].composited === true);
  const r2 = run(swap(base, "ink-900", "#23194280"), P16("ink-900"));
  t("50% fg composited over paper (1 < ratio < 16)", r2.rows[0].ratio > 1 && r2.rows[0].ratio < 16 && r2.rows[0].composited);
  t("background with alpha is refused", failedWith(run(swap(base, "paper", "#fffdf880"), P16("ink-900")), /alpha/));
  t("malformed hex is refused", run(swap(base, "ink-900", "#23194"), P16("ink-900")).failed === 1);
  t("rgba() with alpha is composited too", run(swap(base, "ink-900", "rgba(35, 25, 66, 0.5)"), P16("ink-900")).rows[0].composited === true);

  // later override / duplicates: last declaration wins
  const later = inject(base, "  --sp-ink-900: #cccccc;");
  t("a LATER override in the same scope is what is measured (low contrast => FAIL)", run(later, P16("ink-900")).failed === 1);
  const decoy = swap(base, "ink-900", "#cccccc") + "\n/* --sp-ink-900: #000000; */\n";
  t("a commented-out declaration is ignored (still FAILS)", run(decoy, P16("ink-900")).failed === 1);
  const rgbLater = inject(base, "  --sp-ink-900: rgb(200 200 200);");
  t("a later rgb() override is read, not ignored (FAIL)", run(rgbLater, P16("ink-900")).failed === 1);
  t("an unsupported value (hsl) is refused", failedWith(run(swap(base, "ink-900", "hsl(0 0% 0%)"), P16("ink-900")), /unsupported/));
  const imp = inject(base, "  --sp-ink-900: #cccccc !important;\n  --sp-ink-900: #000000;");
  t("!important beats a later normal declaration (FAIL)", run(imp, P16("ink-900")).failed === 1);

  // var() chains
  const chain = inject(base, "  --sp-alias-a: var(--sp-alias-b);\n  --sp-alias-b: #cccccc;\n  --sp-ink-900: var(--sp-alias-a);");
  t("a var() chain is resolved (ends at #ccc => FAIL)", run(chain, P16("ink-900")).failed === 1);
  const chainOk = inject(base, "  --sp-alias-a: var(--sp-ink-600);\n  --sp-ink-900: var(--sp-alias-a);");
  t("a var() chain that ends in a good colour passes", run(chainOk, P16("ink-900")).failed === 0);
  t("var() fallback is used when the token is missing", run(swap(base, "ink-900", "var(--sp-nope, #231942)"), P16("ink-900")).failed === 0);
  const cyc = inject(base, "  --sp-ink-900: var(--sp-ink-600);\n  --sp-ink-600: var(--sp-ink-900);");
  t("a cyclic var() fails with a clear error", failedWith(run(cyc, P16("ink-900")), /cyclic/));
  t("an unresolved var() fails with a clear error", failedWith(run(swap(base, "ink-900", "var(--sp-nope)"), P16("ink-900")), /unresolved/));

  // per-scope overrides
  const dark = base + "\n@media (prefers-color-scheme: dark) {\n  .sp-shell { --sp-ink-900: #bbbbbb; }\n}\n";
  const rd = run(dark, P16("ink-900"));
  t("a dark @media scope is evaluated separately: base passes, dark FAILS",
    rd.rows.some((x) => x.scope === "base" && x.ok) && rd.rows.some((x) => /dark/.test(x.scope) && !x.ok));
  const sel = base + "\n:root[data-theme=\"dark\"] .sp-shell { --sp-paper: #111111; }\n";
  const rs = run(sel, P16("ink-900"));
  t("a selector scope that redefines a token is evaluated (ink-900 on #111 FAILS there)",
    rs.rows.some((x) => x.scope !== "base" && !x.ok) && rs.rows.some((x) => x.scope === "base" && x.ok));
  const dOk = base + "\n@media (prefers-contrast: more) {\n  .sp-shell { --sp-ink-500: #000000; }\n}\n";
  t("a scope that improves contrast passes and inherits the other base tokens", run(dOk).failed === 0);

  let bad_n = 0;
  for (const [name, ok] of cases) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) bad_n++;
  }
  console.log(`
${cases.length} self-tests, ${bad_n} failed`);
  process.exit(bad_n ? 1 : 0);
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
    const label = `${r.fg} on ${r.bg}`.padEnd(30) + (r.scope === "base" ? "" : ` [${r.scope}]`);
    const val = Number.isNaN(r.ratio) ? "  n/a" : r.ratio.toFixed(2).padStart(5) + ":1";
    const note = r.note ?? `${useLabel(r.use)} (needs ${r.need}:1)${r.composited ? " [alpha composited]" : ""}`;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label} ${val}  ${note}`);
  }
  console.log(`\n${rows.length} pairs checked, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
