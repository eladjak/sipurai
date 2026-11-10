# P1-00 · Screenshot and acceptance harness

**Worker:** Sonnet · **Hours:** 4 · **Wave 1** (no dependencies)

**Result (measurable):** `node scripts/ux/shoot.mjs --url <base> --states scripts/ux/states.example.json --out <dir>` produces, for every listed state, PNGs at 375x812 (DPR 2, touch) and 1280x800, plus a reduced-motion 375 shot, and one `report.json` with per shot: final URL, HTTP status, `lang`/`dir`, `scrollWidth` vs `clientWidth`, interactive elements smaller than 44x44 (tag, accessible name, size), text/background contrast failures below 4.5:1 for normal text and 3:1 for 18px+ (computed colours of visible text nodes), images without `alt`, icon-only buttons without an accessible name, console errors. Exit code 1 if any check fails, unless `--report-only`.

**Read first:** `docs/ux-overhaul/mockups/shoot.cjs` (the prototype used for the mockups), `docs/ux-overhaul/tools/live-shots.cjs`, `playwright.config.js`.

**Owned files:** `scripts/ux/shoot.mjs`, `scripts/ux/checks.mjs`, `scripts/ux/states.example.json`, `scripts/ux/README.md`.

**Must not change:** anything else; no new dependency (use the repo's `@playwright/test` and its Chromium; on the server, if the installed Playwright wants a missing browser build, accept `--chromium <path>` and document `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`).

**States file format:** `[{ "name": "home-empty", "path": "/", "setup": { "localStorage": {...}, "sessionStorage": {...}, "query": "?state=empty" }, "actions": [{ "click": "[data-ux=help-quota]" }], "waitFor": "[data-ux=ready]" }]`. Actions support `click`, `fill`, `press`, `hover`, `waitFor`, `throttle: "slow-4g"`, `offline: true`.

**Tests and evidence:**
- Control run against the mockups: serve `docs/ux-overhaul/mockups/` locally and shoot `a-home.html`, `a-wizard.html`, `a-read.html`: all checks pass.
- **Sabotage run (required):** a temp copy of `a-home.html` with one 30px button, one `width:900px` box and one `#bbb`-on-white paragraph must make the script exit 1 and name all three. Paste both outputs.
- `scripts/ux/README.md`: how to run it, the states format, and how a reviewer reads the report.

**Stop if:** the repo's Playwright cannot launch any Chromium on the server after two attempts (report the error and the paths tried).
