# I-02 · Language check in CI that only allows improvement

**Worker:** Sonnet · **Hours:** 4 · **Wave 1** for development; merges after P1-02 (which declares `@babel/parser` and `@babel/traverse` in `package.json`)

**Result (measurable):**
1. **The audit tool lives in the repository:** `scripts/i18n-audit.mjs`, adapted from the planning copy `/root/work/sipurai-ux-plan/tools/i18n-audit.mjs`, importing Babel from the repo's own `node_modules` (no `NODE_PATH`, no path to another checkout), keeping its control fixture, runnable as `node scripts/i18n-audit.mjs` from a fresh clone after `npm ci`.
2. `node scripts/i18n-check.mjs` runs that audit and compares per-file counts with `scripts/i18n-baseline.json`: language ternaries with literal strings, hard-coded Hebrew and English JSX text and string props, `t()` keys used but missing in he and en, English `aria-label`s. It exits 1 if **any file's count goes up** or a new file appears with a non-zero count, and prints the file, the measure and the line numbers. Counts going down are allowed; `--update-baseline` rewrites the baseline (only to lower numbers unless `--force`). A new workflow `.github/workflows/i18n.yml` runs it on pull requests (`npm ci`, then the scripts, on Node 22).
3. **Hebrew punctuation check:** `scripts/i18n-punctuation.mjs` scans every Hebrew and Yiddish locale value (main files and fragments) and flags a string that contains a Hebrew letter and either **starts** with `! ? . , : ;` (after trimming spaces) or **ends** with an opening quote or bracket (`" „ « ( [`). It prints key, file and value; ratcheted through the same baseline (existing cases recorded, new ones fail); an `allow` list in the script for deliberate cases, each with a one-line reason. Known example: `onboarding.welcome.title` begins with "!". Also flags `t()` calls whose key exists only under another parent (for example code calls `t("welcome.title")` while the file has `onboarding.welcome.title`), as a separate measure.

**Read first:** `COMMON.md`, the language audit (COMMON.md), `docs/ux-overhaul/data/i18n-audit.md`, `.github/workflows/test.yml` (style to follow).

**Owned files:** `scripts/i18n-audit.mjs`, `scripts/i18n-check.mjs`, `scripts/i18n-punctuation.mjs`, `scripts/i18n-baseline.json`, `.github/workflows/i18n.yml`.

**Must not change:** `package.json` (P1-02 declares Babel; no script line needed, the workflow calls the scripts directly), existing workflows, any source or locale file (fixing the flagged strings belongs to the owners of those files: I-03 follow-up for he/en, I-04b for yi, each fragment's owner for fragments).

**Tests and evidence:** the control fixture passes; **sabotage:** in a temp copy of the repo add one `isRTL ? "שלום" : "Hello"` to an existing file and one new `t("does.not.exist")`: the script exits 1 naming both; remove them: exit 0. Paste both outputs. **Punctuation sabotage:** add `"!שלום"` and `"שלום \""` to a temp copy of a fragment: both flagged; remove: clean. Run from a fresh `git clone` + `npm ci` to prove no outside dependency. The generated baseline totals must equal the audit's numbers (127 ternaries, 73 used-but-missing in he) or explain any difference.

**Stop if:** the audit's numbers cannot be reproduced from a clean checkout (report the difference and its cause).
