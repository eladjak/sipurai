# I-05a · Print, orders and admin: text out of the code

**Worker:** Sonnet · **Hours:** 4 · **Wave 3** (after I-01 merges) · **Changes production on purpose (text only)**

**Result (measurable):** in the owned files, the audit shows 0 hard-coded Hebrew or English user-facing strings and 0 language ternaries (today: `PrintCheckout.jsx` 14 text and 10 props, `AdminPrintOrders.jsx` 18 and 6, plus `checkout/*`); English and Yiddish users see English (Yiddish falls back to Hebrew until I-04b). `AddressForm.jsx` phone field gets `dir="ltr"`, `inputMode="tel"`, `autoComplete="tel"`. The print supplier's name appears nowhere in these files' visible text (check and report).

**Owned files:** `src/pages/PrintCheckout.jsx`, `src/pages/MyOrders.jsx`, `src/pages/AdminPrintOrders.jsx`, everything under `src/components/checkout/`, `src/components/i18n/locales/he/print.js`, `en/print.js` (namespace `print`).

**Must not change:** layout, colours, behaviour, validation logic, API calls, `src/lib/printOrder/*`. Text and the phone field attributes only.

**Tests and evidence:** existing checkout tests green (count); the audit for the owned files before and after; screenshots through the existing harness `/__checkout-states` (`VITE_CHECKOUT_HARNESS=1`) in Hebrew and English at 375, before and after, showing the same layout with correct text.

**Stop if:** a string is built by concatenating pieces in a way that breaks Hebrew word order (rewrite as one key with placeholders; if logic must change, report).
