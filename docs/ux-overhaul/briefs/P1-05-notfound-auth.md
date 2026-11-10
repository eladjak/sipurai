# P1-05 · 404 page and themed sign-in / sign-up (switch only)

**Worker:** Sonnet · **Hours:** 4 · **Wave 3** (after P1-01, P1-02, P1-03a, P1-03b and I-01 merge)

**Result (measurable):**
1. `src/screens/notfound/NotFound.jsx`: a night-surface page with the LogoMark, one sentence ("הדף הזה לא נמצא במדף"), a small night illustration slot, and two actions: "חזרה הביתה" and "למדף" (signed in) or "לדף הבית" and "כניסה" (guest). `<title>` and `meta robots noindex`. Text from `locales/{he,en}/notfound.js` (namespace `notFound`). Registered by P1-06a; this contract only builds it.
2. `src/shell/clerkAppearance.js`: a Clerk `appearance` object built from the `sp` tokens (violet primary button, Rubik body, Fredoka headings, radii, RTL-correct button arrow, social buttons in Hebrew where Clerk allows, the "Secured by Clerk" footer kept but restyled quietly).
3. `SignIn.jsx` and `SignUp.jsx`: **when `isNewShell()` is true**, render on the paper surface with the Wordmark (not "Sipurai" in Latin for Hebrew users), a one-line reassurance from `locales/{he,en}/auth.js` (namespace `auth`), and `appearance={clerkAppearance}`; **when it is false, the output is byte-for-byte what it is today** (same gradient, same Latin logo, same appearance object).

**Read first:** `COMMON.md`, `src/pages/SignIn.jsx`, `SignUp.jsx`, `src/components/ClerkLocaleProvider.jsx` (not owned; read only), the live screenshot `docs/ux-overhaul/shots/375-signin-fold.png` (today's defects: Latin wordmark, dark grey button, English footer, arrow on the wrong side), Clerk's appearance documentation (use Context7 for `@clerk/clerk-react` appearance keys; do not guess).

**Owned files:** `src/screens/notfound/NotFound.jsx`, `src/screens/notfound/NotFound.test.jsx`, `src/shell/clerkAppearance.js`, `src/pages/SignIn.jsx`, `src/pages/SignUp.jsx`, `src/components/i18n/locales/he/notfound.js`, `en/notfound.js`, `he/auth.js`, `en/auth.js`.

**Must not change:** `ClerkLocaleProvider.jsx`, Clerk dashboard settings, the redirect validation logic in SignIn (`redirect_url` must stay relative-only), anything else.

**Tests and evidence:**
- Switch-off equivalence: a test that renders SignIn and SignUp with the switch off and compares to a snapshot taken from `origin/main` before your change (commit the snapshot first, red when you break it on purpose).
- NotFound: renders both guest and signed-in variants; `noindex` present.
- Screenshots through `scripts/ux/shoot.mjs` with the switch on: sign-in, sign-up, sign-in with a wrong-password error (Clerk test mode or the dev instance; never create a real account), 404 guest and 404 signed-in, at 375 and 1280, plus reduced motion. Report plus wow checklist.

**Stop if:** Clerk's `appearance` cannot move the button arrow or the footer without a custom component (report what is and is not possible); a test account would be needed to show an error state (use the dev instance's test mode only).
