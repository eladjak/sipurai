# I-05c · Reader: text out of the code

**Worker:** Sonnet · **Hours:** 3 · **Wave 3** (after I-01) · **Changes production on purpose (text only)**

**Result (measurable):** in the owned files: 0 language ternaries with literal strings (today about 19 in `BookView.jsx`), 0 English `aria-label`s ("Zoom in", "Zoom out" at `BookView.jsx:793,805` become Hebrew keys), 0 "XP" in any text a guest or child sees (the guest banner copy that promises XP, `he.jsx:863-867`, is not owned here: instead stop rendering that banner's XP line from `BookView.jsx` and use a neutral sentence from your fragment, "רוצים ספר כזה עם הילד שלכם? נסו בחינם").

**Owned files:** `src/pages/BookView.jsx`, everything under `src/components/bookReader/`, `src/components/i18n/locales/he/reader.js`, `en/reader.js` (namespace `reader`).

**Must not change:** page flip, narration, the building/paused/missing-art states, keyboard handling (`BookView.jsx:383-411`), `GiftEditionCTA` behaviour (text only).

**Tests and evidence:** existing tests green (count); audit before and after; screenshots via `scripts/ux/shoot.mjs` of a public demo book (`/BookView?id=<a public demo id>`, signed out) at 375 and 1280 in Hebrew and English, before and after, showing identical layout with corrected text.

**Stop if:** no public book is reachable signed out (report; use a render test instead).
