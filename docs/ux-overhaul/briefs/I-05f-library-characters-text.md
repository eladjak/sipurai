# I-05f · Old library and characters: text out of the code

**Worker:** Sonnet · **Hours:** 3 · **Wave 3** (after I-01) · **Changes production on purpose (text only)**

**Result (measurable):** in the owned files: 0 English `aria-label`s (today "Clear search" `Library.jsx:265`, "Grid view"/"List view" `Library.jsx:360,367` and `Characters.jsx:235,244`), 0 language ternaries with literal strings, 0 hard-coded user-facing strings. Physical `isRTL ? "right-3" : "left-3"` pairs replaced by logical classes where visually identical.

**Owned files:** `src/pages/Library.jsx`, `src/pages/Characters.jsx`, `src/pages/CharacterEditor.jsx`, everything under `src/components/library/`, `src/components/i18n/locales/he/library.js`, `en/library.js` (namespace `libraryLegacy`).

**Must not change:** behaviour, data loading, layout beyond the logical-class swap; `src/components/shared/CharacterPicker.jsx` (used by the old wizard; not owned).

**Tests and evidence:** tests green (count); audit before and after; render tests in Hebrew and English for the aria-labels; signed-in screenshots wait for the test account (say so).
