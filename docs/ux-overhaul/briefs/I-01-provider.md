# I-01 · Language provider: fallback, fragments, Hebrew default, hidden languages

**Worker:** Sonnet · **Hours:** 4 · **Wave 2** (after I-04a merges) · **Changes production on purpose:** users stop seeing raw keys

**Result (measurable):**
1. **Fallback, never a raw key:** `t(key)` resolves in the current language, then Hebrew, then English; if all miss, it returns an empty string in production and logs `console.warn("[i18n] missing", key)` once per key in development. Replacements (`{name}`) still work after fallback.
2. **Fragments:** the provider deep-merges `locales/<lang>.jsx` with every `locales/<lang>/*.js` loaded through `import.meta.glob(..., { eager: true })`. A fragment whose top-level namespace already exists in the main file, or in another fragment, throws in development and in tests.
3. **Default language:** with no saved choice and no account language, Hebrew, unless the browser language starts with `en` (then English). Today's code starts from English before detection (`getInitialLanguage` returns `'english'`); after this change the first paint for a new visitor is Hebrew RTL.
4. **Hidden languages:** the `languages` value exposed by the context lists only languages whose status in `languageStatus.js` (I-04a) is not `hidden`, **plus** the user's current language if it is hidden (a Yiddish user keeps Yiddish and sees it in the picker); each entry carries `beta: true|false` for pickers to show a badge.
5. The existing account sync (`User.me()` language, `User.updateMyUserData({ language })`) keeps working unchanged.

**Read first:** `COMMON.md`, `src/components/i18n/i18nProvider.jsx` (all), `i18nProvider.test.jsx`, `languageStatus.js` (from I-04a), `docs/ux-overhaul/data/i18n-audit.md`.

**Owned files:** `src/components/i18n/i18nProvider.jsx`, `src/components/i18n/i18nProvider.test.jsx`.

**Must not change:** locale files, pickers (`LandingNav.jsx`, `OnboardingWizard.jsx`, `Settings.jsx` keep reading `languages` from the context), `ClerkLocaleProvider.jsx`.

**Tests and evidence (red first for each):** missing key in Yiddish returns the Hebrew text; missing everywhere returns `""` and warns once; a temporary test fragment merges and is reachable; a colliding fragment throws; first visit with `navigator.language = "he-IL"` and with `"fr-FR"` → Hebrew, with `"en-US"` → English; Yiddish hidden from `languages` for a Hebrew user and present (with `beta`) for a Yiddish user. Run the full test suite and report the count. Then run `the language audit (see COMMON.md for where it runs)` and confirm "used but missing" users would now see fallback text (explain how you checked).

**Stop if:** `import.meta.glob` is unavailable in the Vitest environment (report and propose an explicit import list instead).
