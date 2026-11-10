# Sipurai: two visual directions inside the existing brand

Date: 10.11.2026 · Mockups: `docs/ux-overhaul/mockups/` (static HTML, Hebrew RTL, built 375px first) · Screenshots: `docs/ux-overhaul/mockups/shots/` · Icons: one shared sprite `mockups/icons.svg` (Lucide-compatible stroke icons, so the app keeps one icon library).

## The brand we start from (measured, not invented)

| Token today | Where | Value |
|---|---|---|
| Primary violet | `index.html` theme-color, `--primary: 271 81% 56%` in `src/index.css` | `#7C3AED` |
| Night purple | entry splash background (`index.html`) | `#3B0764` |
| Gold | splash book stroke | `#FCD34D` |
| Cream | splash title | `#FEF3C7` |
| Display font | `tailwind.config.js` `heading`, splash title | Fredoka (has Hebrew glyphs) |
| Body font | `tailwind.config.js` `sans` | Nunito: **has no Hebrew glyphs**, so all Hebrew body text today falls back to the system font (measured on the live site) |
| Card style | `.clay-card` in `src/index.css` | soft "claymorphism", but used once; the app is really 278 ad-hoc gradients and 3,800 raw colour classes (AUDIT §Design-system drift) |
| Wordmark | splash says "סיפוראי"; the app and landing say "Sipurai" | inconsistent |

Both directions keep violet, night, gold and cream, keep Fredoka for display, replace Nunito with a font that actually has Hebrew, and use the Hebrew wordmark "סיפוראי" everywhere a Hebrew user sees it.

---

## Direction A: "לילה טוב" (recommended)

**Feeling:** calm, warm, trustworthy for the parent; magical and soft for the child. A storybook at bedtime.

**Palette (tokens)**
```
--night-900 #1E0B3A   --night-800 #2A1052   --night-700 #3B0764      (child layer, "tonight" card, reading mode)
--violet-600 #7C3AED  --violet-500 #8B5CF6  --violet-100 #EDE7FB  --violet-50 #F6F2FE   (actions, selection, focus)
--gold-400 #FCD34D    --gold-300 #FDE38A    (the one "magic" accent: continue reading, stars, celebration)
--cream-100 #FEF3C7   --cream-50 #FFFBF0    (gift and quota surfaces, text on night)
--ink-900 #231942     --ink-600 #5B5478     --ink-400 #857F9E   --line #ECE6F5
--paper #FFFDF8 (app background)  --card #FFFFFF
```
One accent per view: violet for actions in the parent shell, gold only for "magic" moments. No purple-to-indigo gradients; depth on night surfaces comes from two soft radial glows of the same night family.

**Type:** Fredoka 600/700 for headings and numbers that matter (rounded, friendly, has Hebrew). **Rubik** 400/500/600 for body (rounded Hebrew, excellent at small sizes, pairs with Fredoka's geometry). Scale 13 / 15 / 16 / 20 / 24 / 28 / 34, line height 1.6 for body, tabular numbers everywhere.

**Shape:** radii 12 / 18 / 26 / pill, consistent. Book covers have a spine shadow on the inline end and a slightly asymmetric radius (a real book). Two shadows only (`--shadow-1`, `--shadow-2`).

**Illustration language (needs, not generated here):**
- A hero character set drawn as **model sheets** per family hero (turnaround, 6 expressions, 3 key poses), in a warm hand-made gouache or watercolour style with visible line, so every book and every avatar looks like the same family (this is the 6.11 art-direction lesson).
- Empty states: 5 small spot illustrations (empty shelf with one glowing book; no heroes yet: a door ajar with light; quota used: a sleeping moon; offline: a paper boat; error: a dropped crayon). No text inside images.
- The night sky set: moon, 3 star shapes, a soft cloud, used as SVG (not raster) so it can animate.
- Topic tiles: keep the existing topic photos for now, regenerate later in the same gouache style.

**Motion:** the splash book opening stays (it is already good). Page turns in reading mode 300 to 400ms (declared exception, physical object). Everything else at most 200ms, transform and opacity only. Stars in the jar pop in once per evening with a gentle scale. Writing theatre: each new page fades and rises 8px as it arrives. `prefers-reduced-motion` turns all of it into instant states.

**Parent shell vs child layer:** the shell is day paper (`--paper`), ink text, violet actions. The child layer is the night: reading mode, the "tonight" card, the star jar, and the cover picker are on `--night-800` with cream text and gold accents. A parent always knows which world they are in by the light.

**Mockups:** `mockups/a-home.html` (הלילה, with "מי קורא הלילה", continue / favourite / quieter new story, star collection without streaks, 4-tab bar), `mockups/a-wizard.html` (step 1 "על מי הסיפור הלילה?"), `mockups/a-read.html` (the child layer: night reader with big separate previous/next buttons, play/pause, replay, page dots, word highlight, adult exit), shared `mockups/a.css`.

**Making A distinctive, not generic (from the critique):** the moon, dots and gold glow alone could belong to any bedtime app. A's identity has to come from a commissioned storybook layer: an illustrated family shelf (real covers from the family's books, never colour blocks), the family's own recurring heroes as the avatars, a tactile page motif (deckled paper edge on the night card and reader), and small original details drawn from the family's stories (the dog from last night's book appears on the empty shelf). The tokens are locked only after testing the system with real generated covers.

---

## Direction B: "קופסת צבעים"

**Feeling:** sunny, playful, crafty; paper, crayons and stickers. Speaks loudest to the child.

**Palette (tokens)**
```
--violet #7C3AED  --violet-deep #4C1D95  --violet-soft #EFE8FD   (primary actions)
--sun #FCD34D     --sun-soft #FFF4CC                              (create, highlights)
--coral #F97362   --coral-soft #FFE6E1                            (gifts, voice)
--mint #2BB39A    --mint-soft #DDF5EF                             (family and heroes)
--ink #2A1E4A  --ink-2 #5E5679  --ink-3 #8A84A3   --paper #FFF9EE (dotted)  --edge #2A1E4A
```
Coral and mint are not new to the product: they already appear in the topic cards (`TopicStep.jsx`). Here each gets one job.

**Type:** Fredoka 600/700 for headings, **Varela Round** for body (rounded Hebrew, very child-friendly, a little less legible than Rubik in long text).

**Shape:** "sticker" depth: 2.5px ink outline plus a solid 4px offset shadow; cards and avatars tilted by 1 to 3 degrees; a hand-drawn coral underline under the greeting; dotted paper background.

**Illustration language:** flat cut-paper and crayon, thick outlines matching the sticker edge, stars and suns as stickers. The same model-sheet rule for heroes.

**Motion:** sticker press (the card sinks into its shadow on tap, 150ms), small rotations on hover, a celebration of falling stickers at the end of a book.

**Parent vs child:** one world for both; the parent area is the same style with less colour. That is its weakness (see below).

**Mockups:** `mockups/b-home.html`, `mockups/b-wizard.html`, shared `mockups/b.css`.

---

## What I looked at

Screenshots I opened and read as images: `a-home-375.png` (full page, first build: a 610px horizontal overflow caused by the shell grid's `1fr`; fixed with `minmax(0,1fr)`), `a-home-375-fold.png` (three builds; the last fixed a badly wrapping quota line), `a-home-1280-fold.png`, `a-wizard-375-fold.png`, `a-read-375-fold.png` (checked the RTL reading order: finished page dots on the right, "next" on the left pointing forward), `b-home-375-fold.png` (first build: decorative sun covering the subtitle; fixed and re-checked), `b-wizard-375.png`, `b-wizard-1280-fold.png`. Not opened by eye: `a-wizard-1280*`, `a-read-1280*`, `b-home-1280*`, and the full-page 375 shots of the final builds. Measured by script (`mockups/shoot.cjs`) for all 10 views: no horizontal overflow, no clickable element under 44x44 after the fixes, headings in Fredoka. Codex separately inspected the four 375 fold shots.

## Recommendation: Direction A, with one thing borrowed from B

**A**, because the product decision of 6.11 is a bedtime ritual, and A turns the brand's existing night-and-gold splash into the whole product's language: calm for a tired parent at 20:30, magical for the child, and with a built-in way to separate the parent's day world from the child's night world. B is more fun on first sight, but its loud outlines and tilts tire a parent who opens the app every evening, it gives the parent and the child no visual boundary, and its sticker style competes with the illustrations inside the books, which must be the star.

**Borrow from B:** the concrete, chunky hero selection cards and the voice button ("הילד רוצה לספר בעצמו?") in step 2 of the new-story flow, used in the parent shell only (the microphone never appears in the child layer). The independent critique also chose A, for the clearer continue-reading hierarchy and the calmer parent shell, and warned that A is generic until the storybook identity above is added.

**Bedtime defaults for both:** sound and celebration motion are off by default after 19:00 Israel time, and the night reader never autoplays narration.

## Not verified
- How either direction looks with real generated book illustrations instead of placeholder SVG covers.
- Dark-mode variant of the parent shell (A's night layer is already dark; a full dark parent shell was not drawn).
- Performance of the Fredoka plus Rubik pair on a slow phone (font weight budget about 120KB, to measure in phase 1).
