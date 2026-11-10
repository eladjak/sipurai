# P1-06b · App shell: tab bar, side rail, top bar

**Worker:** Sonnet · **Hours:** 6 · **Wave 3** (after P1-01, P1-02, P1-03a, P1-03b and I-01 merge)

**Result (measurable):** `src/shell/AppShell.jsx` renders children inside `.sp-shell` (imports `sp-tokens.css` and `sp-fonts.css`) with:
- **Phone (under 960px):** a top bar (Wordmark at the start, account avatar at the end, no notification bell) and a bottom tab bar with exactly four tabs from `navItems.js`: הלילה `/` (moon icon), המדף `/shelf`, הגיבורים `/heroes`, הורים `/parents`; 52px+ tall, safe-area padding, active state with `aria-current="page"`, labels always visible.
- **Desktop (960px+):** a side rail at the inline start: Wordmark, a primary "סיפור חדש" button (`/new`), the four items, a divider, "עזרה" (`/help`); sticky, logical border.
- A skip link to `#main-content` (Hebrew text), `main` landmark, focus visible everywhere, no horizontal overflow at 320px.
- Labels and aria text from `locales/{he,en}/shell.js` (namespace `shell`).
- Matches `docs/ux-overhaul/mockups/a-home.html` and `a.css` for the shell parts.

**Read first:** `COMMON.md`, `DESIGN-DIRECTION.md`, `mockups/a-home.html`, `mockups/a.css`, `src/Layout.jsx` (today's shell, read only; note what it does for dark mode, font size and density settings: the new shell keeps reading `user.font_size` and `user.text_density` the same way so those settings stay live).

**Owned files:** `src/shell/AppShell.jsx`, `src/shell/TabBar.jsx`, `src/shell/SideRail.jsx`, `src/shell/TopBar.jsx`, `src/shell/navItems.js`, `src/shell/__tests__/shell.test.jsx`, `src/components/i18n/locales/he/shell.js`, `en/shell.js`.

**Must not change:** `src/Layout.jsx` (stays for switch-off), `App.jsx` (P1-06a wires the shell in), `GamificationOverlay` and `InstallPrompt` (not mounted in the new shell in phase 1; 2.3 and 4.1 bring them back in their new form).

**Tests and evidence:** four tabs render with correct `href` and `aria-current`; rail appears at 960px (matchMedia mock); skip link moves focus; the shell renders a child. Screenshots via `scripts/ux/shoot.mjs` of a test page that mounts AppShell around a placeholder, at 375, 768 and 1280, each tab active once, keyboard focus visible on a tab, reduced motion. Report plus wow checklist.

**Stop if:** `useCurrentUser` or `useI18n` cannot be used outside the old Layout without editing them (report).
