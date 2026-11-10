# P1-03b · Primitives B: Sheet, EmptyState, StepIndicator, Notice, Toast, Wordmark, LogoMark

**Worker:** Sonnet · **Hours:** 6 · **Wave 2** (after P1-01 and P1-02 merge; runs in parallel with P1-03a, no shared files)

**Result (measurable):**
- **Sheet**: bottom sheet on phones, side panel from the inline end on desktop; Radix Dialog underneath (focus trap, Escape, return focus); slide 200ms transform only; drag handle is decorative.
- **EmptyState**: illustration slot (SVG or image, `alt=""` when decorative), one human sentence (title), one optional supporting line, exactly one primary action and an optional quiet one.
- **StepIndicator**: steps as bars with labels, `aria-current="step"`, readable in RTL (first step at the right), compact mode for the top bar.
- **Notice**: inline message in four tones (info, success, warning, danger) with an icon and a "what to do" line; `role="status"` or `role="alert"` by tone; used for generation states (slow, failed, offline).
- **Toast**: a thin wrapper over the existing `src/components/ui/toast.jsx` with the new tokens and an optional **undo** action (the undo pattern replaces "are you sure?" where an action is reversible).
- **Wordmark**: "סיפוראי" in Fredoka 600 for Hebrew and Yiddish, "Sipurai" for English, with the LogoMark; sizes `sm`/`md`/`lg`; the existing staggered entrance from `src/index.css` (`.logo-anim`) is reproduced only under `motion-safe`.
- **LogoMark**: the book mark from the splash (`index.html` SVG: night square, gold book outline) as an inline SVG component.

**Read first:** `COMMON.md`, `DESIGN-DIRECTION.md`, `index.html` (splash SVG), `src/index.css` (logo animation), `src/components/ui/dialog.jsx`, `toast.jsx`, `use-toast.jsx`.

**Owned files:** `src/components/ds/Sheet.jsx`, `EmptyState.jsx`, `StepIndicator.jsx`, `Notice.jsx`, `Toast.jsx`, `src/components/brand/Wordmark.jsx`, `src/components/brand/LogoMark.jsx`, `src/components/ds/__tests__/primitives-b.test.jsx`.

**Must not change:** `src/components/ui/*`, `index.html`, `src/index.css`, any page, any locale file (text through props).

**Splash check (part of this contract):** read `index.html` and `public/entry-splash.js`; confirm in writing that the splash wordmark, colours and timing match DESIGN-DIRECTION; list any mismatch as a finding (do not edit them; they are not owned).

**Tests and evidence:** Sheet traps and returns focus and closes on Escape; StepIndicator exposes `aria-current`; Notice uses the right role per tone; Toast undo calls its handler; Wordmark picks the right text per language. Red runs first. Visual evidence comes from P1-04.

**Stop if:** the existing toast system cannot take an action button without editing `src/components/ui/toast.jsx` (report; do not edit).
