#!/usr/bin/env bun
/**
 * Sipurai E2E smoke test — verify critical surfaces from outside (production).
 *
 * Sipurai is a Vite SPA hosted on Vercel. vercel.json rewrites every non-/api
 * path to /index.html, so ALL client routes return HTTP 200 serving the same
 * shell — the route itself renders client-side via react-router. Therefore:
 *   - SPA routes are checked for HTTP 200 (shell served) only.
 *   - The homepage shell is checked for brand content (it ships in index.html).
 *   - Static SEO assets (sitemap.xml, robots.txt) are checked for integrity.
 *
 * Routes mirror the real app:
 *   public + in sitemap: / /blog /contact /privacy /terms
 *   capitalized app routes: /Pricing /sign-in /sign-up /Library /Characters ...
 *
 * No signup/payment/mutation — read-only GETs only. Safe to run anytime.
 *
 * Usage: bun scripts/e2e-smoke.ts
 *        bun scripts/e2e-smoke.ts --verbose
 *        BASE=https://sipurai.ai bun scripts/e2e-smoke.ts
 */

const BASE = process.env.BASE ?? "https://www.sipurai.ai";
const VERBOSE = process.argv.includes("--verbose");

interface Check {
  name: string;
  path: string;
  expect: number | number[];
  contains?: string[];
  notContains?: string[];
}

const CHECKS: Check[] = [
  // Homepage shell ships brand content directly in index.html
  { name: "Homepage", path: "/", expect: 200, contains: ["סיפוראי", "Sipurai"] },

  // Public routes in the sitemap (SPA — shell 200, content renders client-side)
  { name: "Blog", path: "/blog", expect: 200 },
  { name: "Contact", path: "/contact", expect: 200 },
  { name: "Privacy", path: "/privacy", expect: 200 },
  { name: "Terms", path: "/terms", expect: 200 },

  // Capitalized app routes (the real schema — all 200 SPA shell)
  { name: "Pricing", path: "/Pricing", expect: 200 },
  { name: "Welcome (landing)", path: "/welcome", expect: 200 },
  { name: "Sign in", path: "/sign-in", expect: 200 },
  { name: "Sign up", path: "/sign-up", expect: 200 },
  { name: "Library (gated)", path: "/Library", expect: 200 },
  { name: "Characters (gated)", path: "/Characters", expect: 200 },
  { name: "StoryIdeas (gated)", path: "/StoryIdeas", expect: 200 },
  { name: "Settings (gated)", path: "/Settings", expect: 200 },

  // Static SEO assets — integrity checks
  {
    name: "Sitemap",
    path: "/sitemap.xml",
    expect: 200,
    contains: ["<urlset", "/blog", "/privacy"],
  },
  {
    name: "Robots",
    path: "/robots.txt",
    expect: 200,
    contains: ["User-agent", "Sitemap:", "Disallow: /api/"],
  },
  { name: "Manifest", path: "/manifest.json", expect: 200, contains: ["name"] },
];

async function runCheck(c: Check): Promise<{ pass: boolean; details: string }> {
  try {
    const r = await fetch(BASE + c.path, { redirect: "manual" });
    const expected = Array.isArray(c.expect) ? c.expect : [c.expect];
    if (!expected.includes(r.status)) {
      return { pass: false, details: `expected ${expected.join("|")}, got ${r.status}` };
    }
    if ((c.contains || c.notContains) && r.status === 200) {
      const text = await r.text();
      for (const term of c.contains ?? []) {
        if (!text.toLowerCase().includes(term.toLowerCase())) {
          return { pass: false, details: `HTTP ${r.status} but missing content: ${term}` };
        }
      }
      for (const term of c.notContains ?? []) {
        if (text.toLowerCase().includes(term.toLowerCase())) {
          return { pass: false, details: `HTTP ${r.status} but unexpected content: ${term}` };
        }
      }
    }
    return { pass: true, details: `HTTP ${r.status}` };
  } catch (e) {
    return { pass: false, details: `error: ${(e as Error).message}` };
  }
}

async function main() {
  console.log(`\nSipurai E2E smoke · ${BASE} · ${new Date().toISOString()}\n${"=".repeat(64)}`);
  let pass = 0;
  let fail = 0;
  for (const c of CHECKS) {
    const r = await runCheck(c);
    const icon = r.pass ? "✓" : "✗";
    console.log(`${icon} ${c.name.padEnd(20)} ${c.path.padEnd(16)} ${r.details}`);
    if (r.pass) {
      pass++;
    } else {
      fail++;
    }
  }
  console.log("=".repeat(64));
  console.log(`Total: ${pass + fail} · Pass: ${pass} · Fail: ${fail}`);
  if (VERBOSE) {
    console.log(`\nNote: SPA routes return the index.html shell (HTTP 200) — route\ncontent renders client-side, so per-route content assertions are limited\nto the homepage shell and static SEO assets.`);
  }
  if (fail > 0) {
    process.exit(1);
  }
}

main();
