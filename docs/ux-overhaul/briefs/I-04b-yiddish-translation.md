# I-04b · Yiddish by model translation, reviewed by two other models

**Worker:** a Sonnet agent runs the steps; Codex translates (server, build mode, own worktree); Antigravity (Gemini) and Grok review independently · **Hours:** 8 · **Wave 5** (after I-03, every I-05x, P1-05 and P1-06b merge, so every Hebrew string exists)

**Result (measurable):**
1. `yi.jsx` has every key that `he.jsx` has (from 1,929 keys today, 129 missing), and every Hebrew fragment `locales/he/<area>.js` has a Yiddish twin `locales/yi/<area>.js`. Audit: 0 missing compared with he, 0 used-but-missing for yi.
2. `docs/ux-overhaul/data/yiddish-review.md`: for every new or changed string, the Hebrew source, the Yiddish text, and each reviewer's verdict (ok / suggest / wrong, with the suggestion). Every disagreement listed by name, never merged into one text silently; the final choice and its reason recorded.
3. A summary for the owner: how many strings, how many each reviewer flagged, how many were changed, and the open spelling question.

**Spelling decision first:** today's file uses the standard YIVO spelling (for example "פֿ", "אַ", "ײַ"). Many Yiddish-reading families read Hasidic spelling. Do not change convention silently: keep YIVO, and add to the summary a 10-string sample in both spellings so the owner can decide.

**Steps:**
1. Export the missing keys with their Hebrew and English values and the file:line where each is used (context matters).
2. Translate with Codex: `/opt/shared/ask-engine -t 1200 -w <your worktree> -f <brief> codex`, the brief containing the glossary below, the strings in batches of at most 150, and the rule "child-friendly, warm, plain; keep {placeholders}; do not translate brand names".
3. Review: send the same batches (Hebrew, English, proposed Yiddish) to `ask-engine agy` and `ask-engine grok` separately, without telling either what the other said.
4. Apply: accept where both reviewers say ok; where they disagree or flag, decide and record why.
5. Glossary to keep consistent: סיפוראי, גיבור, מדף, הלילה, הורים, סיפור במתנה, קישור משפחתי, בטא.

**Owned files:** `src/components/i18n/locales/yi.jsx`, every `src/components/i18n/locales/yi/*.js`, `docs/ux-overhaul/data/yiddish-review.md`.

**Must not change:** Hebrew and English files, `languageStatus.js` (the release step belongs to I-04a and needs the owner's or coordinator's word).

**Tests and evidence:** audit before and after; the test suite count; the review file; screenshots via `scripts/ux/shoot.mjs` of three screens in Yiddish (landing, sign-in, the shell with the switch on) at 375, looked at for clipped text and direction errors.

**Stop if:** an engine returns empty or malformed output twice for the same batch (record it, continue with the other reviewer, and list the batch as reviewed by one model only).
