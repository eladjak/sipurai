# Sipurai UX audit

Date: 10.11.2026 · Code: `main` at `754a0da` (fresh clone `/root/work/sipurai-ux-49eb82ff`) · Live: https://www.sipurai.ai

**How this was made.** Signed-out pages: real screenshots of production at 375px and 1280px (headless Chromium on the server, `tools/live-shots.cjs`), plus per-page measurements (`data/i18n-live-pages.json`). Signed-in pages: **read from the code only**, because there is no test account yet. Language consistency: an AST script with a passing control fixture (`tools/i18n-audit.mjs`). Full per-route detail: `data/screen-inventory.md` (337 lines). Every claim below has a file:line, a screenshot, or a command.

## Which screens were seen and which were only read

| Seen as live screenshots (375 and 1280) | Read from code only |
|---|---|
| `/` (guest landing), `/welcome`, `/pricing`, `/blog`, one `/blog/:slug`, `/privacy`, `/terms`, `/accessibility`, `/contact`, `/sign-in`, `/sign-up`, an unknown URL, and `/BookWizard`, `/Library`, `/Settings` while signed out (all three redirect to sign-in) | Home dashboard, BookWizard (6 steps), BookCreation, BookView (signed-in), Characters, CharacterEditor, Library, Profile, Community, CommunityPost, Leaderboard, StoryIdeas, Settings (6 tabs), Feedback, PrintCheckout, MyOrders, AdminPrintOrders, the shell (`Layout.jsx`), the privacy gate |
| Opened by eye (by me or the capture worker): `375-home-fold`, `375-en-home-fold`, `375-pricing-fold`, `375-signin-fold`, `375-404-fold`, `375-blog-fold`, `375-privacy-fold` | The other 40 captures were measured by script, not looked at |

## Headline numbers

| Measure | Value | Source / command |
|---|---|---|
| Page files / registered routes | 29 files (13,699 lines) / 22 registry routes + 12 extra (public, auth, print, harness) | `src/pages`, `src/pages.config.js`, `src/App.jsx` |
| Files over 800 lines | BookWizard 1338, BookView 1247, BookCreation 893, Profile 829 | `wc -l src/pages/*.jsx` |
| Components | about 154 files; 4 feature components never imported (805 lines) + 3 unused UI primitives | screen-inventory §2 |
| Locale keys | he 2053 · en 2056 · yi 1929 | `node docs/ux-overhaul/tools/i18n-audit.mjs` |
| Keys missing vs English | **he 5 · yi 129** | same |
| Keys used in code but missing from the locale | **he 73 · en 73 · yi 146** (the user sees the raw key, e.g. `book.autoSaving`, because `t()` has no fallback) | same; e.g. `AutoSaveIndicator.jsx:13`, `DraftView.jsx:63-249` |
| Untranslated copies (value identical to English) | he 6 · yi 4 | same |
| Hard-coded strings in JSX | Hebrew: 56 text + 44 props · English (2+ words): 26 text + 17 props | same |
| Language ternaries with literal strings (`isRTL ? "גודל" : "Size"`) | **127** | same; worst: `ScenePlanStep.jsx` 36 |
| Lines with Hebrew literals outside the locale files | 1,089 in 73 files | screen-inventory §9 |
| English-only content shown in a Hebrew UI | 123 fields; e.g. 4 sample books `Home.jsx:76-101` ("The Dragon's Quest", "Ocean Explorers", "Stars and Dreams"), 58 in `ModelSelector.jsx` | i18n-audit |
| Base44 leftovers | 18 items, 5 dead and safe to delete | §Base44 below |
| Raw colour utilities vs design tokens | about 3,800 vs **46** | screen-inventory §3 |
| `bg-gradient-to-` / `from-purple` / `to-indigo` | 278 / 241 / 209 | same |
| Emoji used as icons | 86 | same |
| Physical left/right RTL hacks / `flex-row-reverse` | 127 / 156 lines | screen-inventory §9 |
| English `aria-label`s | 17 (e.g. `Layout.jsx:236` "Close sidebar", `:360` "Open menu", `:377` "View profile") | same |
| Settings saved but never read | **8** (see §Settings) | screen-inventory §6; spot-checked `audio_speed` by me |
| Dead or fake controls | AI-Studio model picker `onModelChange={() => {}}` (`Settings.jsx:685`, verified), invented credit meter `?? 100` (`:687`), Contact form opens `mailto:` then shows "sent" (`Contact.jsx:78-84`, verified) | |
| Touch targets under 44px on live pages (375) | 3 to 34 per page; home 34 | `data/i18n-live-pages.json` |
| Images without `loading` | 33 of 36 `<img>` | screen-inventory §3 |

## Screen by screen

Users: **P** parent · **C** child · **PU** power user · **A** admin.

| Route | Purpose | Who | Keep (strong) | Weak or dated (evidence) |
|---|---|---|---|---|
| `/` guest, `/welcome` | Marketing landing | new P | Strong Hebrew headline and one white CTA (seen, `375-home-fold`); demo books from a data file (`ShowcaseSection.jsx:6`) | Latin wordmark "Sipurai" while the splash says "סיפוראי"; "AI" in the badge; fake avatar row "E D C B A" as social proof (seen); duplicate stat 18 (`StatsSection.jsx:39,55`); 2 dead sections (FAQSection, TestimonialsSection) |
| `/` signed-in (Home) | Dashboard | P | Drafts section uses real data; daily prompt is cached | English sample books (`Home.jsx:76-101`); English "Guest" fallback (`:62,164,413`); an LLM call on every dashboard open for the daily prompt (`:117`); XP/level panel first, not the story |
| `/BookWizard` | Make a book | P | Draft autosave and resume (`BookWizard.jsx:187-230`); hand-off to the reader while pages generate; "הפתיעו אותי" | 6 steps, about 12 decision groups, 4 forced inputs before any story; print size asked of everyone (`:334`, hard-coded `"גודל" : "Size"`); structure and preview steps overlap; topic step has 12 different gradients and an infinite shimmer loop (`TopicStep.jsx:363-368`); the hero (the child) is not the first question |
| `/BookCreation` | "Advanced editor" | PU | Autosave indicator; clear tabs | Empty without a book; duplicates the wizard's preview step; 30 missing locale keys in `bookCreation/*` |
| `/BookView` | Read, read aloud, order print | C, P | Page flip, TTS, RTL arrow keys (`:383-411`), back arrow flips | "Zoom in/out" English labels (`:793,805`); "קבל XP" copy to guests (`he.jsx:863-867`); 1,247 lines |
| `/Characters`, `/CharacterEditor` | Family heroes | P | Skeletons with `aria-busy` (`Characters.jsx:122`) | Editor not in nav; 16 language ternaries; no "look" (model sheet) concept, so heroes drift between books |
| `/Library` | Own books | P | Explicit load-error state (`:51`) | Rows and tabs, not covers; English aria-labels (`:265,360,367`); unverified pagination |
| `/Profile` | Profile, XP, badges | P/C | Real persistence | Raw "XP" in Hebrew (`:436,438,586`); overlaps Settings; 21 gradients |
| `/Community`, `/CommunityPost` | Public sharing, comments | P | Parental-approval dialog exists (`Community.jsx:298`) | Likes kept in the browser and written with a read-modify-write race (`:220-226`); public comments with children's books |
| `/Leaderboard` | Rank users | C/P | Pagination | Everyone except you gets invented XP: 100 per book (`Leaderboard.jsx:112`, verified), streak 0, level 1; children's names on a public board |
| `/StoryIdeas` | Idea generator | P | Saves ideas | Not in nav; third way to start a story |
| `/Settings` | 6 tabs | P | Appearance settings are live (`Layout.jsx:86,200-212`) | 8 settings never read; decorative AI-Studio tab; 6 icon-only tabs on mobile (`:450`); English uppercase tracking on Hebrew labels |
| `/Pricing` | Plans | new P | Clear free tier "5 ספרים בחודש" (seen) | Two stacked titles ("מסלולים פשוטים, ערך גדול" and "תוכניות ומחירים") with an empty grey band between them; no header or nav, only "← דף הבית" with a Unicode arrow mixed into Hebrew (RTL trap 16); black, off-brand button; different font from the landing (seen, `375-pricing-fold`) |
| `/sign-in`, `/sign-up` | Clerk | new P | Hebrew labels | "Secured by clerk" in English, Latin "Apple/Google", dark grey off-brand button, arrow on the wrong side (seen, `375-signin-fold`) |
| unknown URL | 404 | anyone | | No 404 for guests: every unknown URL lands on sign-in (seen; byte-identical to sign-in) |
| `/blog`, `/blog/:slug` | SEO | new P | Real Hebrew content | Featured-card placeholder clips the title text (seen, `375-blog-fold`) |
| `/privacy`, `/terms`, `/accessibility` | Legal | all | Well-formed Hebrew (seen) | Mixed date formats; Terms is 58 inline Hebrew lines outside i18n; the accessibility statement sits in the primary nav |
| `/Contact` | Support | P | Public | Does not send; email field without `dir="ltr"` (`:236`) |
| `/Feedback` | Per-book collaboration | P | Accept/reject flow | Only reachable from a book card menu; name collides with Contact |
| Print: `/book/:id/order`, `/orders`, `/admin/print-orders` (flag) | Order a printed book | P, A | Stepper, validation, `dir="ltr"` on phone and zip | Hebrew-only hard-coded (36 + 35 lines); `AddressForm.jsx:62` tel without `dir="ltr"`; no nav link to `/orders` |
| Shell `Layout.jsx` | Side menu, top bar | all | Skip link (`:217`); grouped sections | 11 items in 5 sections; hamburger only on mobile, no bottom bar; RTL done with `isRTL ? 'justify-end flex-row-reverse'` (`:50`); purple-to-indigo gradient active state; uppercase `tracking-wider` section headers that mean nothing in Hebrew (`:244`); English aria-labels; the sidebar link `/welcome` labelled with the English domain "sipurai.ai" (`:337`) |

## Language consistency

- **The UI language is decided per browser** (`localStorage.language`), and the very first default in code is `'english'` (`i18nProvider.jsx:44`) before browser detection runs. A fresh he-IL visitor does get Hebrew (measured), but a parent who once picked English on a shared tablet sees an English app.
- **Three layers of text** coexist: locale keys (2,053 he), 127 inline ternaries, and 1,089 hard-coded Hebrew lines. Yiddish is 129 keys behind and has 146 used-but-missing keys, so Yiddish users see raw keys in many places.
- **Fonts:** Nunito (body) has no Hebrew glyphs, so every Hebrew paragraph renders in the phone's system font while headings are Fredoka. The pricing page visibly uses a third face.
- **Brand name:** "Sipurai" (Latin) in the app shell, landing nav and sign-in; "סיפוראי" only in the splash.
- **Jargon in Hebrew UI:** "XP" (`he.jsx:863-867,1605,1772,2354`), "קרדיטים" (`he.jsx:1992,2242,2490`), "סטודיו AI" tab, model and provider names.

## Base44 leftovers (18; 5 dead and safe to delete)

Dead: `src/lib/VisualEditAgent.jsx` (Base44 visual-edit protocol, dev only; `App.jsx:7-10`) · `src/components/UserNotRegisteredError.jsx` (English "Access Restricted" screen, unreachable: `AuthContext.jsx:103,147` only sets `authError: null`) · `isLoadingPublicSettings` (always false) · Base44 guard in `src/test/setup.js:5` · `e2e/legacy-base44/`.
Live patterns that are Base44 shape: `pages.config.js` registry with `__Layout` and "auto-generated" header; `createPageUrl` with 115 call sites producing PascalCase URLs (`/BookWizard`, `/Library`), and the `/pricing` vs `/Pricing` case split (`App.jsx:93`); the entity wrapper API (`.list("-field", n)`) in 14 entity files; stale comments in `supabaseEntity.js`, `supabaseClient.js:69`, `Core.js:4-5`, `User.js:59`, `OnboardingWizard.jsx:190`. Documentation: `CLAUDE.md:22,40,42` still describes a `src/api` folder that does not exist.
Layout patterns inherited from the no-code era: one long left/right sidebar with uppercase section headers, gradient everything, a gamification panel as the home screen, a settings page with an "AI Studio" tab, and a leaderboard.

## Accessibility and RTL defects (beyond the counts above)
- No bottom navigation on mobile; the menu is behind a hamburger that measured 40x40 on the landing.
- Language attribute and direction are right on every live page (`lang=he dir=rtl`, measured), but much of the RTL inside the app is simulated with `flex-row-reverse` (156 lines), which breaks keyboard order and screen-reader order.
- Inputs without `dir="ltr"`: Contact email (`Contact.jsx:236`), ShareOptions email (`ShareOptions.jsx:382`), AddressForm phone (`AddressForm.jsx:62`).
- 61 arrow/chevron icons outside `ui/`; only BookView flips them explicitly. Unicode arrows mixed into Hebrew on Pricing.
- Settings tabs become 6 icon-only buttons on mobile.
- Positive: zero `div onClick` without a role, zero `href="#"`, skip link present, privacy gate in place.

## Performance smells
- Four page files above 800 lines; 258 framer-motion elements in 57 files, including an infinite shimmer on the wizard's main button.
- An LLM call for the daily prompt on each dashboard open (`Home.jsx:117`).
- 33 of 36 images without lazy loading; Nunito downloaded although it cannot render Hebrew.

## Not verified
Signed-in screens visually (no test account) · real mobile gestures · Clerk's full Hebrew strings · Library pagination · where the wizard's `child_*` fields come from · server-side role check for the admin print page · settings read through dynamic keys · 40 of 47 live captures were measured, not looked at.

## Added after the owner's decisions (10.11.2026)
- **The print supplier is named in the public privacy policy:** `src/data/privacyPolicyContent.js` lists "ספק ההדפסה BookPod" in the Hebrew text and names it again in the English text, shown on `/privacy` and in the consent gate's full policy. This conflicts with the product rule that users never see the supplier's name. Decision D10 in PLAN.md.
- **The personal sample before sign-up** is compatible with the policy as written (it lists only what is kept; the sample keeps nothing). Two traps for its implementation: the sign-in redirect address and the page-view analytics record URLs, so the name must never enter a URL; and `trackEvent` (`src/lib/analytics.js`) must not receive it. See VISION.md decision 4 and PLAN.md D9.
- **Language sync already exists:** the provider reads `User.me().language` and writes `User.updateMyUserData({ language })` (`i18nProvider.jsx`), so "language belongs to the account" needs no new work; only the first-visit default (English before detection) changes, in contract I-01.
- **CI installs with `npm ci`** (`.github/workflows/test.yml`), while the project also keeps `bun.lock`: any dependency change must update both lock files (contract P1-02).
