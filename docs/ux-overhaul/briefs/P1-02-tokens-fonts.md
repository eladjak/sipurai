# P1-02 · Tokens, Tailwind `sp` namespace, self-hosted fonts, contrast check

**Worker:** Sonnet · **Hours:** 5 · **Wave 1**

**Result (measurable):**
1. `src/styles/sp-tokens.css` defines every `--sp-*` token from the table in `docs/ux-overhaul/DESIGN-DIRECTION.md` (names and values exactly), scoped to `.sp-shell` and `:root[data-sp-shell]` so nothing applies unless the new shell adds that class or attribute; it also defines the reduced-motion belt for `.sp-shell`.
2. `src/styles/sp-fonts.css` declares self-hosted Fredoka (600, 700) and Rubik (400, 500, 600) with the **Hebrew and Latin subsets** and `font-display: swap`, through `@fontsource/fredoka` and `@fontsource/rubik` (or their variable packages). Neither CSS file is imported anywhere yet (P1-03a/b, P1-05, P1-06b import them inside switch-gated modules), so production downloads nothing new.
3. `tailwind.config.js` gains, under `theme.extend`, an `sp` colour namespace mapping to the CSS variables (`sp-night-800`, `sp-violet-600`, `sp-ink-500`, …), `borderRadius` `sp-sm/md/lg/pill`, `boxShadow` `sp-1/sp-2`, `fontFamily` `sp-display/sp-body`, `fontSize` `sp-xs` 13/1.5 … `sp-3xl` 34/1.2, `transitionTimingFunction` `sp-out`. **No existing key changes.**
4. `scripts/check-contrast.mjs` reads `sp-tokens.css` and prints the WCAG ratio for each pair listed in a table inside the script (ink-900/600/500 on paper and card; on-night and on-night-muted on night-800/900; white on violet-600; night-900 on gold-400; danger and success on their 50s), exiting 1 if a text pair is under 4.5:1 (ink-400 is expected to fail for small text; the script marks it "large text only" and checks 3:1).

**Read first:** `docs/ux-overhaul/DESIGN-DIRECTION.md` (tokens), `tailwind.config.js`, `src/index.css`, `index.html` (the current Google Fonts link stays untouched).

**Owned files:** `src/styles/sp-tokens.css`, `src/styles/sp-fonts.css`, `tailwind.config.js`, `package.json`, `bun.lock`, `package-lock.json`, `scripts/check-contrast.mjs`.

**Must not change:** `src/index.css`, `index.html`, any existing Tailwind key, any existing class's output. Add the font packages with `bun add` **and** update `package-lock.json` (`npm install --package-lock-only`), because CI runs `npm ci`.

5. `package.json` also declares, as devDependencies, the parser the language audit needs: `@babel/parser` and `@babel/traverse` (same major versions as in `/root/work/sipurai-dash-1179515851/node_modules`), so contract I-02 can commit the tool and run it in CI from a fresh clone. Both lock files updated.

**Before adding the packages:** run the `dep-scan` skill (or `npx osv-scanner` on the lockfile) for the two packages and paste the verdict.

**Tests and evidence:**
- Production unchanged: build `main` and your branch with the switch off and compare `dist/assets/*.css` after sorting rules: the only difference allowed is none (the new CSS is not imported). Paste the command and the diff size (expected 0 bytes of difference in the main CSS bundle). Note: new Tailwind utilities appear only when used, so the bundle must be identical.
- `node scripts/check-contrast.mjs` output (all text pairs pass).
- A throwaway HTML page in your temp folder that imports both CSS files and shows the Hebrew pangram "דג סקרן שט בים מאוכזב ולפתע מצא חברה" in each weight; screenshot at 375 through `scripts/ux/shoot.mjs` if P1-00 has merged, otherwise plain Playwright; confirm by eye that the Hebrew renders in Fredoka/Rubik, not a fallback (and check `document.fonts.check('16px Rubik','שלום')` returns true after load).

**Stop if:** a font package has no Hebrew subset, or a Babel package version cannot be matched (then report which package version and the alternative); the dep scan says BLOCK.
