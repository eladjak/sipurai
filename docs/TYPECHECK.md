# Type checking (JavaScript with `checkJs`)

`bun run typecheck` runs TypeScript over the JSX code (`jsconfig.json`, `checkJs: true`). Nothing is compiled; it only reports.

## The gate: "never worse"

`node scripts/check-types.mjs` (also `bun run typecheck:gate`, and the **Type check** GitHub job) compares the per-file error counts with `typecheck-baseline.json`.

| Situation | Result |
|---|---|
| any file has more errors than in the baseline, or a clean file gets one | **fails**, lists the files |
| you fixed errors but did not lower the baseline | **fails** (so the freed room cannot be used up by new errors later) |
| same or equal | passes |

**Lowering the baseline** after you fix errors: `node scripts/check-types.mjs --update`, commit `typecheck-baseline.json`. The command refuses to raise any number.
**Raising it** (only if a new error is truly unavoidable, say why in the PR): add `--allow-increase`.

## What was done (numbers measured with `tsc -p jsconfig.json`, TypeScript 5.9.3)

1,718 errors on main -> 295 now.

| Category | Before | After | How |
|---|---|---|---|
| Unannotated `React.forwardRef` components (shadcn UI) have their props typed as the empty object, so every `className` / `children` / `onClick` at every use is flagged | 1,132 | 0 | `src/types/react-js.d.ts`: in a JS project the type of an unannotated prop bag is `any` |
| `import.meta.env` unknown | 42 | 0 | `src/types/vite-env.d.ts` (`vite/client` types) |
| Errors reported inside `node_modules` JavaScript | 17 | 0 | `maxNodeModuleJsDepth: 0` (jsconfig defaults to 2) |
| `toast({...})` "Expected 0 arguments" | 100 | 0 | one declaration: JSDoc type on `ToastContext` (it was inferred from `() => {}`) |
| `window.umami`, `navigator.userLanguage`, `process` | 15 | 0 | `src/types/globals.d.ts` |
| Mislabeled JSDoc on `LoadingOverlay` | 7 | 0 | corrected the `@param` |

## Real bug the checker found

`src/lib/errorTracking.js`: Sentry's `beforeSend` called `.map` on `event.breadcrumbs.values`. In Sentry v8+ `breadcrumbs` is an array, so `.values` is `Array.prototype.values` (a function) and the call threw; Sentry then drops the event. Result: errors that carry breadcrumbs were never reported, and the child-privacy scrub never ran for them. Fixed with tests (`src/lib/errorTracking.test.js`).

## What remains (295), and what to do next

| Category | Count | Typical cause | Next step | Estimate |
|---|---|---|---|---|
| `Property 'x' does not exist on type '{}'` | 88 | `useState({})` / `useState({...})` then reading fields (Settings 23, IdeaForm 19, Contact 17, PrintCheckout 17) | JSDoc `@type` on the `useState` initial value | 3 h |
| Missing required prop (TS2741 / TS2739) | 90 | JS function components destructure props, so TypeScript treats every one as required (`Badge variant`, `Field optional`, `className`) | default values `= undefined`/`= ""` in the shared primitives first (about 50 of them), then the rest | 3 h |
| Object/props not assignable (TS2322, `IntrinsicAttributes & object`) | 49 | `React.memo(function X({a,b}))` without prop docs; CSS custom properties; string vs union | JSDoc `@param` per component | 3 h |
| Argument shape (TS2345 / TS2353) | 29 | `generateImage` options JSDoc lists every field as required; `GenerationRecipe`, `buildRecipe`, `generateScenePlan` typedefs miss fields that the code does use | complete the typedefs in `aiProvider.js`, `bookRecipe.js`, `sceneGenerator.js` | 2 h |
| Misc (arithmetic on dates, `createContext()` without default, old IE property) | ~30 | typing pedantry, not defects | fix when touching the file | 1 h |

Roughly **12 hours** to reach zero; after that change the gate to "zero errors" by setting the baseline to 0.

## Not changed on purpose

`pages/BookCreation.jsx` line 278 passes a scene plan to `getStoryOutlinePrompt()`, which takes no arguments, so the plan is ignored by the outline prompt. That may be an unfinished feature rather than a typo, so it is reported here and left alone.
