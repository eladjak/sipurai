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

export function parseTokens(css) {
  const vars = {};
  for (const m of css.matchAll(/--sp-([a-z0-9-]+)\s*:\s*#([0-9a-fA-F]+)\s*;/g)) {
    vars[m[1]] = parseHex(m[2]);
  }
  return vars;
}

// -> { r, g, b, a } (0-255, a 0-1) or { invalid: true }
function parseHex(h) {
  if (![3, 4, 6, 8].includes(h.length)) return { invalid: true, raw: h };
  let x = h.length <= 4 ? [...h].map((c) => c + c).join("") : h;
  const n = (i) => parseInt(x.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: x.length === 8 ? n(6) / 255 : 1 };
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
  const vars = parseTokens(css);
  const rows = [];
  let failed = 0;
  for (const [fg, bg, use] of pairs) {
    const row = { fg, bg, use, ratio: NaN, ok: false };
    const f = vars[fg], b = vars[bg];
    if (!f || !b) row.note = "token missing";
    else if (f.invalid || b.invalid) row.note = "unreadable colour (use #rgb or #rrggbb)";
    else {
      try {
        row.ratio = ratio(f, b);
        row.composited = f.a < 1;
        row.need = use === "icon" || isLarge(use.px, use.weight) ? 3 : 4.5;
        row.ok = row.ratio >= row.need;
      } catch (e) {
        row.note = e.message;
      }
    }
    if (!row.ok) failed++;
    rows.push(row);
  }
  return { rows, failed };
}

function useLabel(u) {
  return u === "icon" ? "icon / non-text" : `${u.px}px ${u.weight >= 700 ? "bold" : u.weight}`;
}

function selfTest() {
  const base = readFileSync(join(here, "..", "src", "styles", "sp-tokens.css"), "utf8");
  const cases = [];
  const t = (name, ok) => cases.push([name, ok]);
  t("shipped tokens pass", run(base).failed === 0);
  t("ink-400 as 18px regular text FAILS", run(base, [["ink-400", "paper", { px: 18, weight: 400 }]]).failed === 1);
  t("ink-400 as 20px bold passes (18.66px+ bold)", run(base, [["ink-400", "paper", { px: 20, weight: 700 }]]).failed === 0);
  t("ink-400 as 18px bold FAILS (below 18.66)", run(base, [["ink-400", "paper", { px: 18, weight: 700 }]]).failed === 1);
  t("ink-400 as 24px regular passes", run(base, [["ink-400", "paper", { px: 24, weight: 400 }]]).failed === 0);
  t("isLarge boundaries", !isLarge(23.9, 400) && isLarge(24, 400) && !isLarge(18.6, 700) && isLarge(18.66, 700));
  // alpha: transparent foreground must not be read as opaque black
  const clear = base.replace("--sp-ink-900: #231942", "--sp-ink-900: #00000000");
  const r1 = run(clear, [["ink-900", "paper", { px: 16, weight: 400 }]]);
  t("fully transparent fg is composited (invisible => FAILS, not read as black)", r1.failed === 1 && r1.rows[0].composited === true);
  const half = base.replace("--sp-ink-900: #231942", "--sp-ink-900: #23194280");
  const r2 = run(half, [["ink-900", "paper", { px: 16, weight: 400 }]]);
  t("50% fg is composited over paper (ratio between 1 and the opaque 16.02)", r2.rows[0].ratio > 1 && r2.rows[0].ratio < 16 && r2.rows[0].composited === true);
  const bgA = base.replace("--sp-paper: #fffdf8", "--sp-paper: #fffdf880");
  const r3 = run(bgA, [["ink-900", "paper", { px: 16, weight: 400 }]]);
  t("background with alpha is refused with an error", r3.failed === 1 && /alpha/.test(r3.rows[0].note));
  const bad = base.replace("--sp-ink-900: #231942", "--sp-ink-900: #23194");
  t("malformed hex is refused", run(bad, [["ink-900", "paper", { px: 16, weight: 400 }]]).failed === 1);
  let bad_n = 0;
  for (const [name, ok] of cases) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
    if (!ok) bad_n++;
  }
  console.log(`\n${cases.length} self-tests, ${bad_n} failed`);
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
    const label = `${r.fg} on ${r.bg}`.padEnd(30);
    const val = Number.isNaN(r.ratio) ? "  n/a" : r.ratio.toFixed(2).padStart(5) + ":1";
    const note = r.note ?? `${useLabel(r.use)} (needs ${r.need}:1)${r.composited ? " [alpha composited]" : ""}`;
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label} ${val}  ${note}`);
  }
  console.log(`\n${rows.length} pairs checked, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
