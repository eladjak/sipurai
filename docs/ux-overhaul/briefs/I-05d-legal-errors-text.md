# I-05d · Legal pages, privacy policy wording (D9, D10, D11), error screens

**Worker:** Sonnet · **Hours:** 6 · **Wave 3** (after I-01) · **Changes production on purpose:** text of the legal pages and error screens

**Owner decisions this contract carries out (10.11.2026):**
- **D10:** the privacy policy (Hebrew and English, including the consent-gate summary in the same file) names **categories** of processors, not brands, wherever the law does not require a name; a person can ask for the full list at the contact address; any place where a name may be legally required is **flagged, not silently removed**.
- **D9:** one added sentence about the name sample before sign-up. **No policy version bump, no re-consent:** `api/_lib/policyVersion.js` is not touched.
- **D11:** the Hebrew terms are binding; English and Yiddish users see the Hebrew text with a note saying so.

**Result (measurable):**
1. `src/data/privacyPolicyContent.js`: every brand name in user-visible text is replaced by its category. Brands found there today (count of occurrences): BookPod 2, Morning 2, חשבונית ירוקה 1, Creem 4, Clerk 6, Supabase 4, Vercel 4, Google 13, OpenAI 10, Gemini 2, Sentry 2, Umami 2, Sanity 2. Categories, Hebrew / English: "ספק הדפסה" / "printing provider" · "ספק סליקה" / "payment provider" · "שירות חשבוניות" / "invoicing service" · "ספקי בינה מלאכותית" / "AI providers" · "שירות התחברות" / "sign-in service" · "שירות אחסון ונתונים" / "storage and database service" · "שירות אירוח" / "hosting service" · "שירות דיווח תקלות" / "error-reporting service" · "שירות מדידת ביקורים שרץ על הדומיין שלנו, בלי עוגיות" / "visit counting on our own domain, without cookies" · "שירות תוכן לבלוג" / "blog content service" · "שירות גופנים" / "font service" (the fact that the IP address reaches it stays) · "צ'אט השאלות נענה בעזרת ספק בינה מלאכותית". Where a processor sits outside Israel, the policy keeps saying so by category ("חלק מהספקים פועלים מחוץ לישראל, בעיקר בארצות הברית").
2. A new line in the processors section, Hebrew and English: *"רוצים לדעת בדיוק אילו חברות? כתבו ל־support@sipurai.ai ונשלח את הרשימה המלאה."* / *"Want the exact companies? Write to support@sipurai.ai and we will send the full list."* (use `CONTACT_EMAIL`, not a literal).
3. The D9 sentence in section 2, Hebrew and English: *"**בדף הבית, לפני הרשמה:** אפשר להקליד שם כדי לראות ספר לדוגמה. השם נשאר רק בדפדפן שלכם, לא נשלח אלינו ולא נשמר."* / *"**On the home page, before signing up:** you can type a name to see a sample book. The name stays in your browser only; it is not sent to us and not stored."* `LAST_UPDATED` is set to the merge date; `POLICY_VERSION` unchanged.
4. `docs/ux-overhaul/data/policy-processor-names.md`: one row per removed brand: the brand, the category now shown, where it was (line), and **"might the law require the name here?"** with a reason or "unknown, for a lawyer". At minimum flag: transfers abroad (the destination country is stated by category; whether each recipient must be named is a legal question), and the AI providers that receive children's names and descriptions. This file is the input for the owner's lawyer; the contract does not decide legal questions.
5. **Terms (D11):** the 58 inline Hebrew lines of `TermsOfService.jsx` move word for word to `src/data/termsContent.js` (same pattern as the privacy file); for English and Yiddish the page shows the Hebrew terms (`dir="rtl"`, `lang="he"` on that block) under a note from the fragment: *"The Hebrew version below is the binding version of these terms."* and its Yiddish twin (added by I-04b; until then the English note).
6. Page chrome of `/privacy`, `/terms`, `/accessibility`, plus `ErrorBoundary.jsx`, `FriendlyError.jsx`, `src/lib/PageNotFound.jsx`: every visible string from the `legal` fragment; error messages say what to do next ("לנסות שוב", "חזרה הביתה") and link to help; the mixed ISO/Hebrew date on `/privacy` resolved in the chrome.

**Read first:** `COMMON.md`, `src/data/privacyPolicyContent.js` (all, including the header rule "say only what the code really does"), `api/_lib/orders/service.js:24-30` (the existing sanitizer that already strips the supplier's name from responses: leave it), VISION.md decision 4.

**Owned files:** `src/data/privacyPolicyContent.js`, `src/data/termsContent.js` (new), `src/pages/TermsOfService.jsx`, `src/pages/PrivacyPolicy.jsx`, `src/pages/AccessibilityStatement.jsx`, `src/components/ErrorBoundary.jsx`, `src/components/shared/FriendlyError.jsx`, `src/lib/PageNotFound.jsx`, `src/lib/PageNotFound.test.jsx`, `src/pages/__tests__/legal-content.test.jsx` (new), `src/components/i18n/locales/he/legal.js`, `en/legal.js` (namespace `legal`), `docs/ux-overhaul/data/policy-processor-names.md`.

**Must not change:** `api/_lib/policyVersion.js`, `src/components/privacy/*` (the consent gate renders text from the policy file, so it changes through that file only), the meaning of any legal sentence other than the brand-to-category change and the two added sentences, any Terms wording.

**Acceptance tests (in `legal-content.test.jsx`, each written red first):**
- **No brand in any rendered policy:** render `/privacy` in Hebrew, English and Yiddish, and render the consent-gate summary, and assert that none of `BookPod, בוקפוד, Morning, חשבונית ירוקה, Creem, Clerk, Supabase, Vercel, Google, OpenAI, Gemini, Sentry, Umami, Sanity` appears in the text (case-insensitive). **Control:** the same assertion fails when the test injects "BookPod" into a copy of the content (prove the test can fail).
- **D9 sentence present** in the rendered Hebrew and English policy.
- **Contact line present** (the "full list" sentence) in Hebrew and English.
- **Version unchanged:** `POLICY_VERSION` equals the value on `origin/main`.
- **Binding-language note:** present on `/terms` for English and Yiddish, absent for Hebrew; the terms text itself is byte-identical to `origin/main` (compare the rendered text).
- Run the full suite and report the count.

**Evidence:** the tests above; the processor-names file; screenshots via `scripts/ux/shoot.mjs` of `/privacy` (he, en), `/terms` (he, en), `/accessibility`, a forced error boundary and the old 404 at 375; the diff of the policy text for the owner to read (before/after, readable, not only the code diff).

**Stop if:** removing a name makes a sentence untrue or meaningless (report the sentence); a processor appears in the code but not in the policy, or the reverse (report; do not add or remove processors here).
