# P1-06a · New addresses, redirects and the switch in `App.jsx`

**Worker:** Sonnet, with the strong model reviewing the diff before the PR is opened (routing touches every user) · **Hours:** 6 · **Wave 4** (after P1-04, P1-05, P1-06b merge)

**Result (measurable):**
1. **Switch off: nothing changes.** The existing routing code path in `App.jsx` stays as it is; the new routing is a separate branch entered only when `isNewShell()` is true (an early `if` that renders `<NewShellRoutes/>`), so the old path is untouched by construction.
2. **Switch on**, `src/lib/routes.js` defines the phase-1 table:
   - Tabs and destinations wrapped in `AppShell` (P1-06b), rendering today's pages for now: `/` signed in → Home; `/shelf` → Library; `/heroes` → Characters; `/parents` → Settings; `/new` → BookWizard; `/help` → a simple help index using `EmptyState` with links to `/help/contact` (Contact page) and `/help/accessibility` (AccessibilityStatement).
   - Pages that read `?id=` keep their current addresses in phase 1 (`/BookView`, `/CharacterEditor`, `/CommunityPost`, `/BookCreation`, `/Feedback`) but render inside `AppShell`; their new addresses arrive with their phase-2 PRs.
   - Public pages unchanged in address (`/`, `/welcome`, `/blog`, `/blog/:slug`, `/privacy`, `/terms`, `/pricing`, `/sign-in/*`, `/sign-up/*`) and not wrapped in the shell.
   - **Permanent redirects** (client `Navigate replace`, keeping query string and hash): `/Library`→`/shelf`, `/Characters`→`/heroes`, `/Settings` and `/Profile`→`/parents`, `/BookWizard`→`/new`, `/StoryIdeas`→`/new`, `/Contact` and `/contact`→`/help/contact`, `/Accessibility` and `/accessibility`→`/help/accessibility`, `/Pricing`→`/pricing`, `/Blog`→`/blog`, `/PrivacyPolicy`→`/privacy`, `/TermsOfService`→`/terms`, `/Home`, `/Dashboard`, `/LandingPage`→`/`, `/Leaderboard` and `/Community` keep working in phase 1 (removed in 4.1).
   - **Unknown address → `NotFound`** (P1-05) for guests and users alike; known protected addresses still send guests to sign-in with `redirect_url`.
   - `/__ui` → `UiGallery` only when `import.meta.env.DEV` or `VITE_UI_GALLERY === "1"`.
   - The privacy gate keeps wrapping signed-in routes exactly as today.
3. Server-side: `vercel.json` rewrites are **not** changed (the SPA fallback already serves every path); note in the PR whether any server redirect would be better later.

**Read first:** `COMMON.md`, `src/App.jsx` (all of it), `src/pages.config.js`, `src/lib/RedirectHome.jsx` and its test, `vercel.json` (read only), VISION.md navigation, PLAN.md route map.

**Owned files:** `src/App.jsx`, `src/lib/routes.js`, `src/lib/routes.test.js`, `src/lib/RedirectHome.jsx`, `src/lib/RedirectHome.test.jsx`.

**Must not change:** page components, `pages.config.js`, `Layout.jsx`, `vercel.json`, the auth and privacy-gate logic (only re-used).

**Tests and evidence:**
- **Equivalence test, written first:** with the switch off, render `App` inside `MemoryRouter` for every path in a fixture list (all 22 registry routes, the public ones, `/Dashboard`, an unknown path, signed in and guest via mocked auth) and assert the rendered page component and the layout used; generate the fixture from `origin/main`, then prove the test goes red if you change one route on purpose.
- **Redirect table test:** every legacy shape above, including `/Library?tab=drafts#x` → `/shelf?tab=drafts#x`; unknown path → NotFound for a guest; `/BookWizard` as a guest → sign-in with `redirect_url=/new`.
- Screenshots via `scripts/ux/shoot.mjs` with the switch on, signed out: `/`, `/pricing`, unknown path, `/help` (guest view if public, else the sign-in redirect), at 375 and 1280. Signed-in screenshots wait for the test account (say so).
- `bun run build` with the switch off and on; show that with it off the main JS chunk does not contain the strings `sp-shell` or `NewShellRoutes` (proof the bundler dropped the new code).

**Stop if:** the equivalence fixture cannot be produced without changing the old code path (report); a redirect needs server config (report, do not edit `vercel.json`).
