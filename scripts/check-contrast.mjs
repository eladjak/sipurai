#!/usr/bin/env node
// WCAG contrast check for the Sipurai design tokens (contract P1-02).
//
//   node scripts/check-contrast.mjs [path/to/sp-tokens.css]
//
// Reads the --sp-* custom properties and prints the contrast ratio of every
// pair in PAIRS. Exit code 1 if a text pair is under 4.5:1, or a "large"
// pair (icons, 18px+ text) is under 3:1. ink-400 is expected to fail as small
// text, so it is only checked against 3:1 and marked "large text only".

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(here, "..", "src", "styles", "sp-tokens.css");

// [foreground token, background token, kind]; kind "text" needs 4.5, "large" needs 3.
export const PAIRS = [
  ["ink-900", "paper", "text"],
  ["ink-900", "card", "text"],
  ["ink-600", "paper", "text"],
  ["ink-600", "card", "text"],
  ["ink-500", "paper", "text"],
  ["ink-500", "card", "text"],
  ["ink-400", "paper", "large"],
  ["ink-400", "card", "large"],
  ["on-night", "night-800", "text"],
  ["on-night", "night-900", "text"],
  ["on-night-muted", "night-800", "text"],
  ["on-night-muted", "night-900", "text"],
  ["card", "violet-600", "text"], // white text on the primary action
  ["night-900", "gold-400", "text"],
  ["danger", "danger-50", "text"],
  ["success", "success-50", "text"],
];

export function parseTokens(css) {
  const vars = {};
  for (const m of css.matchAll(/--sp-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    vars[m[1]] = m[2].toLowerCase();
  }
  return vars;
}

function channel(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((x) => x + x).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function run(css) {
  const vars = parseTokens(css);
  const rows = [];
  let failed = 0;
  for (const [fg, bg, kind] of PAIRS) {
    if (!vars[fg] || !vars[bg]) {
      rows.push({ fg, bg, kind, ratio: NaN, ok: false, note: "token missing" });
      failed++;
      continue;
    }
    const r = ratio(vars[fg], vars[bg]);
    const need = kind === "large" ? 3 : 4.5;
    const ok = r >= need;
    if (!ok) failed++;
    rows.push({ fg, bg, kind, ratio: r, ok, need });
  }
  return { rows, failed };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let css;
  try {
    css = readFileSync(file, "utf8");
  } catch (e) {
    console.error(`cannot read ${file}: ${e.message}`);
    process.exit(1);
  }
  const { rows, failed } = run(css);
  for (const r of rows) {
    const label = `${r.fg} on ${r.bg}`.padEnd(34);
    const note = r.note ?? (r.kind === "large" ? "large text only (needs 3:1)" : "text (needs 4.5:1)");
    const val = Number.isNaN(r.ratio) ? "  n/a" : r.ratio.toFixed(2).padStart(5) + ":1";
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label} ${val}  ${note}`);
  }
  console.log(`\n${rows.length} pairs checked, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
