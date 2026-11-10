# I-05b · Advanced editor and story-structure: text out of the code

**Worker:** Sonnet · **Hours:** 5 · **Wave 3** (after I-01) · **Changes production on purpose (text only)**

**Result (measurable):** in the owned files the audit shows 0 language ternaries with literal strings (today `ScenePlanStep.jsx` alone has 36) and 0 hard-coded user-facing strings; physical `isRTL ? "ml-2" : "mr-2"` pairs replaced by logical classes (`ms-2`) where the change is visually identical (verify by screenshot); English `aria-label`s become Hebrew keys. These files are the base of the future studio (phase 5), so they are worth cleaning now.

**Owned files:** `src/pages/BookCreation.jsx`, everything under `src/components/bookCreation/`, everything under `src/components/storyBuilder/`, `src/components/i18n/locales/he/studio.js`, `en/studio.js` (namespace `studio`).

**Must not change:** behaviour, generation calls, layout beyond the logical-class swap, `src/components/wizard/*` and `src/pages/BookWizard.jsx` (replaced in phase 2; not owned).

**Tests and evidence:** existing tests green (count); audit before and after for the owned files; signed-in screenshots need the test account: if it is not available, render `ScenePlanStep` and `BookEditorTab` in a Vitest render test in Hebrew and English and attach the text snapshots, and say that the visual check waits for the account.

**Stop if:** a key you need already exists in `he.jsx` under `book.*` (owned by I-03): use the existing key, do not duplicate it in your fragment.
