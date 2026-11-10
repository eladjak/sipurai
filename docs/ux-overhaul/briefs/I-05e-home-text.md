# I-05e · Old home: English sample books and "Guest"

**Worker:** Sonnet · **Hours:** 2 · **Wave 3** (after I-01) · **Changes production on purpose (text and sample content only)**

**Result (measurable):** the signed-in home on the old shell (still what users see until PR 2.15) shows no English in a Hebrew interface:
- The three English sample books (`Home.jsx:76-101`, "The Dragon's Quest", "Ocean Explorers", "Stars and Dreams") are replaced by the bilingual demo books already in `src/data/demoBooks.js` (title and description in the user's language, real demo covers from `public/demo/`), keeping `isSample: true` behaviour.
- The English fallback name "Guest" (`Home.jsx:62,164,413`) becomes a fragment key ("אורח" / "Guest") or, better, no name at all in the greeting.
- Remaining ternaries and hard-coded strings in the owned files go to the fragment.

**Owned files:** `src/pages/Home.jsx`, everything under `src/components/home/`, `src/components/i18n/locales/he/home.js`, `en/home.js` (namespace `homeLegacy`).

**Must not change:** layout, the daily-prompt call, gamification display (replaced in 2.3 and 4.1), `src/data/demoBooks.js` (read only).

**Tests and evidence:** a render test in Hebrew proving no Latin-only title appears in the featured section; tests green (count); audit before and after; signed-in screenshots wait for the test account (say so).
