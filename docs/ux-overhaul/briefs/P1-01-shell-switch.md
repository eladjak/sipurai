# P1-01 · The `VITE_NEW_SHELL` switch

**Worker:** Haiku · **Hours:** 1 · **Wave 1**

**Result (measurable):** `src/lib/flags.js` exports `isNewShell()` that returns `true` only when `import.meta.env.VITE_NEW_SHELL === "true"` (string compare; unset, `"1"`, `"TRUE"` and anything else are `false`), and `NEW_SHELL_ENV_NAME = "VITE_NEW_SHELL"`. Written so the bundler can drop new-shell code when off: a module-level `const NEW_SHELL = import.meta.env.VITE_NEW_SHELL === "true"` and `export const isNewShell = () => NEW_SHELL`.

**Read first:** how `VITE_PRINT_ORDER_ENABLED` is read in `src/App.jsx:22-24`.

**Owned files:** `src/lib/flags.js`, `src/lib/flags.test.js`.

**Must not change:** everything else. No `.env` file is created or edited (the owner sets the variable on the preview environment).

**Tests and evidence:** `flags.test.js` with `vi.stubEnv` cases: unset → false, `"true"` → true, `"1"` → false, `"TRUE"` → false. Show the red run (test written before the module) and the green run, with the test count.

**Stop if:** `vi.stubEnv` cannot affect a module-level constant in this Vitest setup; then use `vi.resetModules()` and a dynamic import per case, and say so.
