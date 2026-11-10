# I-04a · Hide Yiddish now, with a beta status

**Worker:** Haiku · **Hours:** 1 · **Wave 1** (I-01 waits for this)

**Result (measurable):** `src/components/i18n/languageStatus.js` exports `LANGUAGE_STATUS = { hebrew: "live", english: "live", yiddish: "hidden" }` and `isHidden(lang)`, `isBeta(lang)` where the allowed values are `"live" | "beta" | "hidden"`. Unknown languages are treated as `"hidden"` (fail closed). When the Yiddish pass (I-04b) is accepted, the release step is a one-line change of `yiddish` to `"beta"` in this same contract's file, made on the owner's or coordinator's word.

**Owned files:** `src/components/i18n/languageStatus.js`, `src/components/i18n/languageStatus.test.js`.

**Must not change:** everything else (I-01 consumes this file).

**Tests and evidence:** values, helpers, unknown language → hidden. Red then green with the test count.
