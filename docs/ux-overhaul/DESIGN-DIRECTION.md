# Sipurai design direction: "לילה טוב" (approved 10.11.2026)

The owner approved direction A. Direction B ("קופסת צבעים") is archived with its mockups in `archive/DESIGN-DIRECTION-v1-with-B.md` and `mockups/archive/`; two ideas from it survive (chunky, concrete hero cards; the voice button in the parent shell).

**The bar, in the owner's words:** every screen in this app, existing, rebuilt or not yet built, every system and sub-system, at an outstanding "wow" standard. People judge by this and must feel that whoever built it cared. There is no "internal", "later" or "unstyled" screen (PLAN.md lists every route and the PR that brings it to this bar).

## The brand we start from (measured)

| Today | Where | Value |
|---|---|---|
| Primary violet | `index.html` theme-color, `--primary: 271 81% 56%` | `#7C3AED` |
| Night purple | entry splash | `#3B0764` |
| Gold / cream | splash | `#FCD34D` / `#FEF3C7` |
| Display font | Fredoka (has Hebrew) | kept |
| Body font | Nunito: **no Hebrew glyphs**, so Hebrew falls back to the phone's font | replaced by Rubik |
| Wordmark | splash "סיפוראי", app and landing "Sipurai" | "סיפוראי" for Hebrew users, everywhere |

## Feeling
Calm, warm and trustworthy for the parent; magical and soft for the child. A storybook at bedtime. **Two worlds told apart by light:** the parent shell is day paper; the child layer (reader, the "tonight" card, the star collection) is night.

## Tokens (canonical names; contracts in `briefs/` depend on them)

CSS custom properties, prefix `--sp-`, defined in `src/styles/sp-tokens.css`; Tailwind exposes them under the `sp` namespace. Old shadcn variables are **not** changed in phase 1, so production looks the same until the switch flips.

| Group | Tokens |
|---|---|
| Night | `--sp-night-900 #1E0B3A` · `--sp-night-800 #2A1052` · `--sp-night-700 #3B0764` |
| Violet (actions, selection, focus) | `--sp-violet-700 #6D28D9` (hover) · `--sp-violet-600 #7C3AED` · `--sp-violet-500 #8B5CF6` · `--sp-violet-100 #EDE7FB` · `--sp-violet-50 #F6F2FE` |
| Gold (the one "magic" accent) | `--sp-gold-400 #FCD34D` · `--sp-gold-300 #FDE38A` |
| Cream (gifts, text on night) | `--sp-cream-100 #FEF3C7` · `--sp-cream-50 #FFFBF0` |
| Ink | `--sp-ink-900 #231942` (text) · `--sp-ink-600 #5B5478` (secondary) · `--sp-ink-500 #6E6889` (small notes, at least 4.5:1 on paper) · `--sp-ink-400 #857F9E` (**only** icons, 18px+ text, disabled) |
| Surfaces | `--sp-paper #FFFDF8` · `--sp-card #FFFFFF` · `--sp-line #ECE6F5` |
| On night | `--sp-on-night #FEF3C7` · `--sp-on-night-muted #CDBEF0` |
| Status | `--sp-danger #B42318` · `--sp-danger-50 #FEF3F2` · `--sp-success #15803D` · `--sp-success-50 #F0FDF4` |
| Radius | `--sp-r-sm 12px` · `--sp-r-md 18px` · `--sp-r-lg 26px` · `--sp-r-pill 999px` |
| Shadow | `--sp-shadow-1: 0 1px 2px rgba(35,25,66,.06),0 4px 14px rgba(35,25,66,.06)` · `--sp-shadow-2: 0 2px 6px rgba(35,25,66,.08),0 14px 34px rgba(35,25,66,.12)` |
| Type | `--sp-font-display: "Fredoka"` (600/700) · `--sp-font-body: "Rubik"` (400/500/600); scale 13 / 15 / 16 / 20 / 24 / 28 / 34 (Tailwind `text-sp-xs … text-sp-3xl`); body line height 1.6; tabular numbers everywhere |
| Motion | `--sp-ease-out: cubic-bezier(.22,1,.36,1)` · `--sp-dur-fast 150ms` · `--sp-dur 200ms` · `--sp-dur-page 350ms` (page turn only) |

Rules: one accent per view (violet for actions; gold only for magic moments); no purple-to-indigo gradients; depth on night surfaces only from soft radial glows of the night family; two shadows only; fonts self-hosted (also removes the IP disclosure to Google Fonts for the app shell).

## Shape, illustration and identity
- Radii as above, book covers with a spine shadow on the inline end and an asymmetric radius.
- **What keeps A from being generic** (the critique's warning): a commissioned storybook layer: real covers from the family's own books (never colour blocks), the family's heroes as avatars, a deckled page edge on night surfaces, small details drawn from the family's stories (yesterday's dog appears in an empty state). Tokens are locked only after testing against 12 real generated covers (Track V).
- Illustration needs: hero model sheets (turnaround, 6 expressions, 3 poses) in one warm hand-made style; 5 empty-state spots; a night-sky SVG set; the star collection; no text inside any image; every image through `illustration-check`.
- One icon library (Lucide); the mockup sprite `mockups/icons.svg` is Lucide-compatible.

## Motion
The splash book opening stays. Page turn 350ms (declared exception). Everything else at most 200ms, transform and opacity only. Writing theatre: each new page fades and rises 8px. Stars appear with a gentle scale once. **After 19:00 Israel time sound and celebration motion are off by default; narration never autoplays.** `prefers-reduced-motion` makes every state instant.

## The child layer vs the parent shell
| | Parent shell | Child layer |
|---|---|---|
| Surface | `--sp-paper`, ink text | `--sp-night-800/900`, cream text |
| Actions | violet | gold for the one main action, large separate buttons |
| Allowed | everything | reading, narration, page turns only: no purchases, sharing, open text, microphone, links out, notifications |
| Exit | normal | press and hold (a speed bump, said honestly), plus help for the phone's screen pinning |

## Mockups (direction A)
`mockups/a-home.html` (הלילה: who reads tonight, continue, favourite, quieter new story with gift count, star collection), `mockups/a-wizard.html` (new story, step 1), `mockups/a-read.html` (the night reader), shared `mockups/a.css`. Screenshots in `mockups/shots/`; measured for all six views: no horizontal overflow, no target under 44px, headings in Fredoka. Looked at by eye: `a-home-375-fold` (final), `a-home-1280-fold`, `a-wizard-375-fold`, `a-read-375-fold`; Codex inspected the 375 folds independently.

## The wow checklist every PR passes (from `wow-ui-standard` and `impeccable`)
1. Brand tokens only; no raw colours, no ad-hoc gradients, no library-default look.
2. Every interactive element has hover, active and focus-visible states; nothing is dead (run the dead-element audit).
3. Spacious by default on a 4/8 grid; exact right alignment; type hierarchy with at least 1.25 steps.
4. Icon plus label for navigation and actions; one icon library; no emoji as icons.
5. Every state designed: empty (illustration plus one human sentence plus one action), loading (skeleton, not a spinner, where content is known), error (says what to do), success (a small, quiet moment), limited or blocked.
6. Motion diet: transform and opacity, at most 200ms for feedback, reduced-motion belt, no infinite loops in content.
7. Right-to-left by logical properties; `dir="ltr"` with the right input mode for phone, email, numbers and dates; arrows point the reading direction.
8. Accessibility: targets at least 44px, labels bound, errors announced, contrast AA, works at 200% text.
9. Plain Hebrew copy from the locale files; no jargon; a "?" next to every amount, limit, status or unusual term.
10. The `impeccable` slop scan finds none of its tells (purple gradients, glassmorphism, icon-tile cards, cream reflex backgrounds, em-dash copy, flat hierarchy).
11. 375px and 1280px screenshots of every state, looked at by a person or by a second engine, and the question answered in writing: "would we proudly show this?"
