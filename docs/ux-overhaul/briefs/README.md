# Execution contracts: phase 1 and the language track

Every worker reads `COMMON.md` first, then its own contract. Each contract is sized for one run of a cheaper model. **No file is owned by two contracts** (matrix below). Phase 1 changes nothing for production users while `VITE_NEW_SHELL` is off; the language track fixes text in production on purpose.

## Order and waves (at most four workers at a time)

| Wave | Contracts | Can start when |
|---|---|---|
| **1 (parallel from the start)** | P1-00 harness · P1-01 switch · P1-02 tokens, fonts and Babel declaration · I-02 audit tool, CI ratchet, punctuation check · I-03 missing keys (PR #14 open) · I-04a Yiddish visibility | now; I-02 is developed now but merges after P1-02 |
| 2 | I-01 provider · P1-03a primitives A · P1-03b primitives B | I-01 after I-04a merges; P1-03a/b after P1-01 and P1-02 merge |
| 3 | I-05a print · I-05b studio base · I-05c reader · I-05d legal and errors · I-05e home · I-05f library and characters · P1-04 gallery · P1-05 404 and sign-in · P1-06b shell layout | I-05x after I-01; P1-04 after P1-00, P1-03a, P1-03b; P1-05 and P1-06b after P1-03a, P1-03b and I-01 |
| 4 | P1-06a routing and redirects | after P1-04, P1-05, P1-06b |
| 5 | I-04b Yiddish model translation | after I-03, all I-05x, P1-05, P1-06b (so every Hebrew string exists) |

## Contracts

| ID | Title | Worker | Hours |
|---|---|---|---|
| [P1-00](P1-00-ux-harness.md) | Screenshot and acceptance harness | Sonnet | 4 |
| [P1-01](P1-01-shell-switch.md) | The `VITE_NEW_SHELL` switch | Haiku | 1 |
| [P1-02](P1-02-tokens-fonts.md) | Tokens, Tailwind `sp` namespace, self-hosted fonts, contrast check | Sonnet | 5 |
| [P1-03a](P1-03a-primitives-a.md) | Button, IconButton, Card, Chip, Field, HelpTip | Sonnet | 7 |
| [P1-03b](P1-03b-primitives-b.md) | Sheet, EmptyState, StepIndicator, Notice, Toast, Wordmark, LogoMark | Sonnet | 6 |
| [P1-04](P1-04-ui-gallery.md) | Component gallery `/__ui` | Sonnet | 3 |
| [P1-05](P1-05-notfound-auth.md) | 404 page and themed sign-in/sign-up (switch only) | Sonnet | 4 |
| [P1-06b](P1-06b-shell-layout.md) | App shell: tab bar, side rail, top bar | Sonnet | 6 |
| [P1-06a](P1-06a-routing.md) | New addresses, redirects, switch wiring in `App.jsx` | Sonnet, reviewed by the strong model | 6 |
| [I-01](I-01-provider.md) | Fallback, fragments, Hebrew default, hidden languages | Sonnet | 4 |
| [I-02](I-02-ci-ratchet.md) | Audit tool in the repo, CI ratchet, Hebrew punctuation check | Sonnet | 4 |
| [I-03](I-03-missing-keys.md) | Fill used-but-missing keys in he and en | Sonnet | 4 |
| [I-04a](I-04a-yiddish-visibility.md) | Hide Yiddish now, beta flag | Haiku | 1 |
| [I-04b](I-04b-yiddish-translation.md) | Yiddish model translation with two reviewing models | Codex (build mode) + Antigravity + Grok, run by Sonnet | 8 |
| [I-05a](I-05a-print-text.md) | Print, orders, admin text | Sonnet | 4 |
| [I-05b](I-05b-studio-text.md) | Advanced editor and story-structure text | Sonnet | 5 |
| [I-05c](I-05c-reader-text.md) | Reader text | Sonnet | 3 |
| [I-05d](I-05d-legal-errors-text.md) | Privacy policy without brand names (D10), sample sentence (D9), binding Hebrew terms (D11), error screens | Sonnet | 6 |
| [I-05e](I-05e-home-text.md) | Old home: English sample books, "Guest" | Sonnet | 2 |
| [I-05f](I-05f-library-characters-text.md) | Old library and characters text | Sonnet | 3 |

## Ownership matrix (exclusive)

| Contract | Owns |
|---|---|
| P1-00 | `scripts/ux/shoot.mjs`, `scripts/ux/checks.mjs`, `scripts/ux/states.example.json`, `scripts/ux/README.md` |
| P1-01 | `src/lib/flags.js`, `src/lib/flags.test.js` |
| P1-02 | `src/styles/sp-tokens.css`, `src/styles/sp-fonts.css`, `tailwind.config.js`, `package.json` (fonts and the Babel devDependencies for the audit), `bun.lock`, `package-lock.json`, `scripts/check-contrast.mjs` |
| P1-03a | `src/components/ds/Button.jsx`, `IconButton.jsx`, `Card.jsx`, `Chip.jsx`, `Field.jsx`, `HelpTip.jsx`, and `src/components/ds/__tests__/primitives-a.test.jsx` |
| P1-03b | `src/components/ds/Sheet.jsx`, `EmptyState.jsx`, `StepIndicator.jsx`, `Notice.jsx`, `Toast.jsx`, `src/components/brand/Wordmark.jsx`, `src/components/brand/LogoMark.jsx`, `src/components/ds/__tests__/primitives-b.test.jsx` |
| P1-04 | `src/pages/UiGallery.jsx`, `src/pages/UiGallery.test.jsx` |
| P1-05 | `src/screens/notfound/NotFound.jsx`, `src/screens/notfound/NotFound.test.jsx`, `src/shell/clerkAppearance.js`, `src/pages/SignIn.jsx`, `src/pages/SignUp.jsx`, `locales/he/notfound.js`, `locales/en/notfound.js`, `locales/he/auth.js`, `locales/en/auth.js` |
| P1-06b | `src/shell/AppShell.jsx`, `TabBar.jsx`, `SideRail.jsx`, `TopBar.jsx`, `navItems.js`, `src/shell/__tests__/shell.test.jsx`, `locales/he/shell.js`, `locales/en/shell.js` |
| P1-06a | `src/App.jsx`, `src/lib/routes.js`, `src/lib/routes.test.js`, `src/lib/RedirectHome.jsx`, `src/lib/RedirectHome.test.jsx` |
| I-01 | `src/components/i18n/i18nProvider.jsx`, `src/components/i18n/i18nProvider.test.jsx` |
| I-02 | `scripts/i18n-audit.mjs`, `scripts/i18n-check.mjs`, `scripts/i18n-punctuation.mjs`, `scripts/i18n-baseline.json`, `.github/workflows/i18n.yml` |
| I-03 | `src/components/i18n/locales/he.jsx`, `src/components/i18n/locales/en.jsx` |
| I-04a | `src/components/i18n/languageStatus.js`, `src/components/i18n/languageStatus.test.js` |
| I-04b | `src/components/i18n/locales/yi.jsx`, every `src/components/i18n/locales/yi/*.js`, `docs/ux-overhaul/data/yiddish-review.md` |
| I-05a | `src/pages/PrintCheckout.jsx`, `MyOrders.jsx`, `AdminPrintOrders.jsx`, `src/components/checkout/*`, `locales/{he,en}/print.js` |
| I-05b | `src/pages/BookCreation.jsx`, `src/components/bookCreation/*`, `src/components/storyBuilder/*`, `locales/{he,en}/studio.js` |
| I-05c | `src/pages/BookView.jsx`, `src/components/bookReader/*`, `locales/{he,en}/reader.js` |
| I-05d | `src/data/privacyPolicyContent.js`, `src/pages/__tests__/legal-content.test.jsx` (new), `docs/ux-overhaul/data/policy-processor-names.md`, `src/pages/TermsOfService.jsx`, `PrivacyPolicy.jsx`, `AccessibilityStatement.jsx`, `src/data/termsContent.js` (new), `src/components/ErrorBoundary.jsx`, `src/components/shared/FriendlyError.jsx`, `src/lib/PageNotFound.jsx`, `src/lib/PageNotFound.test.jsx`, `locales/{he,en}/legal.js` |
| I-05e | `src/pages/Home.jsx`, `src/components/home/*`, `locales/{he,en}/home.js` |
| I-05f | `src/pages/Library.jsx`, `Characters.jsx`, `CharacterEditor.jsx`, `src/components/library/*`, `locales/{he,en}/library.js` |

(`locales/` = `src/components/i18n/locales/`.) Nobody owns `src/Layout.jsx`, `src/pages/Settings.jsx`, `Profile.jsx`, `Community*.jsx`, `Leaderboard.jsx`, `StoryIdeas.jsx`, `Feedback.jsx`, `BookWizard.jsx` or `src/components/wizard/*` in these waves: they are replaced later. `api/_lib/policyVersion.js` is owned by nobody: the policy version does not change (D9, owner's decision).
