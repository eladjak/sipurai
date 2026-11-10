# I-03 · Fill the used-but-missing keys in Hebrew and English

**Worker:** Sonnet · **Hours:** 4 · **Wave 1** · **Changes production on purpose:** texts that today show a raw key now show words

**Result (measurable):** `the language audit (see COMMON.md for where it runs)` reports **0 keys used in code but missing** for he and en (from 73), and 0 keys missing in he compared with en (from 5: `home.features.title`, `home.features.subtitle`, `onboarding.profile.age`, `onboarding.profile.name`, `onboarding.profile.namePlaceholder`). The 6 Hebrew values identical to English are either translated or justified (a brand name, an email).

**Read first:** `COMMON.md`, `docs/ux-overhaul/data/i18n-audit.json` (the full lists with file:line), each file where a missing key is used (to write the right words for the context), the owner's language rules: plain Hebrew a non-technical parent understands, no jargon ("XP", "קרדיטים", "פרומפט"), short sentences.

**Owned files:** `src/components/i18n/locales/he.jsx`, `src/components/i18n/locales/en.jsx`.

**Must not change:** any component (the keys stay as the code calls them), `yi.jsx` (I-04b), fragments.

**Copy rules:** Hebrew is the source; English is faithful, not marketing. Where the existing English key exists and is good, translate it; where the context shows the key is a leftover, still provide words (deleting dead keys is a separate job).

**Tests and evidence:** the audit before and after (paste the "used but missing" lines); the full test suite count; a table in the PR of every key added with its Hebrew and English text, for the strong model and Codex to review for tone.

**Stop if:** a key's meaning cannot be told from its use site (list it, give your best guess marked for review).

**Follow-up (same contract, after I-02 merges; PR #14 covered the first part):** fix every Hebrew string `scripts/i18n-punctuation.mjs` flags in `he.jsx` (leading `! ? . , : ;`, trailing opening quote), and add or move keys so every `t()` call resolves at the path the code uses (e.g. `welcome.*`, `topics.*` called at top level while the file has them under `onboarding`; choose the change that touches only the locale files, since components are not owned here). Evidence: the punctuation script and the audit before and after, the test count.
