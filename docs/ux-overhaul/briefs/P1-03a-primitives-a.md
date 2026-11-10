# P1-03a · Primitives A: Button, IconButton, Card, Chip, Field, HelpTip

**Worker:** Sonnet · **Hours:** 7 · **Wave 2** (after P1-01 and P1-02 merge)

**Result (measurable):** six components in `src/components/ds/`, styled only with `sp-*` tokens, each wrapping an accessible primitive where one exists, used by nothing yet:
- **Button**: variants `primary` (violet), `magic` (gold, for the one magic action on night surfaces), `quiet`, `danger`, `onNight`; sizes `md` (48px high) and `lg` (56px); `loading` state (keeps width, spinner plus `aria-busy`), `disabled`; icon slot at the start or end with `gap` (no Unicode arrows); renders `<a>` when given `href`.
- **IconButton**: 44x44 minimum, required `label` prop used as `aria-label`, tooltip on desktop hover only.
- **Card**: `paper` and `night` surfaces, `interactive` mode (whole card is one link/button with hover lift ≤ 3px and focus ring) vs static.
- **Chip**: selectable (role `checkbox` or `radio` decided by the parent group), optional `cost` badge (for suggestion chips: "סיפור 1 מהמתנה"), 44px tall.
- **Field**: label bound by id, `hint` text visible under the label, example placeholder, `error` shown under the field and announced (`aria-describedby` plus `aria-invalid`, live region), `dir` forced to `ltr` with the right `inputMode` and `autoComplete` for `type` tel, email, number, url, date; textarea variant with a character counter.
- **HelpTip**: the "?" button (44px target, 24px visual) opening a Radix Popover on tap and on keyboard, closing on Escape and outside tap, `aria-label="הסבר: <topic>"` from a prop, content 1 to 2 sentences, logical placement (`side` start/end), collision-aware.

**Read first:** `COMMON.md`, `DESIGN-DIRECTION.md` (tokens, wow checklist), `rules/tooltips-hebrew.md` (10 rules, in the owner's `~/.claude/rules/`; the relevant points are restated above), `src/components/ui/button.jsx`, `popover.jsx`, `tooltip.jsx` (existing Radix wrappers you may import but not edit).

**Owned files:** `src/components/ds/Button.jsx`, `IconButton.jsx`, `Card.jsx`, `Chip.jsx`, `Field.jsx`, `HelpTip.jsx`, `src/components/ds/__tests__/primitives-a.test.jsx`. Each component file imports `@/styles/sp-tokens.css` (gated by being used only in switch-on code).

**Must not change:** `src/components/ui/*`, any page, any locale file (all text comes in through props).

**Tests and evidence:** per component: renders, keyboard (Tab, Enter/Space, Escape for HelpTip), `aria-*` correctness, Field error announced, `dir="ltr"` applied for tel/email/date, Button loading keeps the label for screen readers. Red run first for each. Visual evidence is produced in P1-04 (gallery); here, attach one 375 screenshot of a throwaway test page if P1-00 has merged.

**Stop if:** a Radix package needed is not installed (do not add it; report).
