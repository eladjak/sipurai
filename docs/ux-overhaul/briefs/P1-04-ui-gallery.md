# P1-04 · Component gallery `/__ui`

**Worker:** Sonnet · **Hours:** 3 · **Wave 3** (after P1-00, P1-03a, P1-03b merge)

**Result (measurable):** `src/pages/UiGallery.jsx` shows every primitive from P1-03a and P1-03b in every state (default, hover via a forced class, focus, active, disabled, loading, error, empty, selected, with cost, on paper and on night, Hebrew and English side by side), each block marked with `data-ux="<component>-<state>"` so `scripts/ux/shoot.mjs` can target it. Wrapped in `.sp-shell`. The route is registered by P1-06a only when the switch is on **and** `import.meta.env.DEV` or the preview environment, never in a production build with the switch off.

**Read first:** `COMMON.md`, the two primitive contracts, `scripts/ux/README.md`.

**Owned files:** `src/pages/UiGallery.jsx`, `src/pages/UiGallery.test.jsx`.

**Must not change:** the primitives (report defects to their owners instead), `pages.config.js`, `App.jsx`.

**Copy exception:** sample text inside the gallery may be inline (it is a developer page); it must still be correct Hebrew.

**Tests and evidence:**
- A render test that every `data-ux` block exists.
- `scripts/ux/shoot.mjs` run against a local dev server with the switch on (a temporary local route in your worktree only, not committed, or the gallery rendered through a Vitest browser harness; say which), covering every block at 375 and 1280, plus reduced motion. Attach the report (no overflow, no small target, no contrast failure) and the wow checklist answered per component.
- Look at every screenshot and write one line per component; list defects found in the primitives as findings addressed to P1-03a/P1-03b.

**Stop if:** you cannot render the gallery without editing `App.jsx` (then use the Vitest-browser or a temporary uncommitted route and say so).
