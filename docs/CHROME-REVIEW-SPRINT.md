# Sipurai — Chrome MCP Review Sprint

**Project:** Sipurai (sipurai.ai) — AI children's book creation platform
**Framework:** React 18 + Vite (JSX) + React Router DOM v6
**i18n:** Hebrew-first, RTL, with English & Yiddish support
**Last QA session:** 2026-03-23 (Session 37)

---

## 1. URLs

| Environment | URL |
|-------------|-----|
| **Local dev** | `http://localhost:5173` (run `npm run dev` in project root) |
| **Production** | `https://sipurai.ai` |
| **Analytics** | `https://analytics.sipurai.ai` |

**Start the dev server first:**
```bash
cd ~/projects/sipurai
npm run dev
```

---

## 2. Chrome MCP Setup

Load Chrome MCP tools before starting. Use ToolSearch to load each tool as needed:

```
ToolSearch: "select:mcp__claude-in-chrome__navigate"
ToolSearch: "select:mcp__claude-in-chrome__computer"
ToolSearch: "select:mcp__claude-in-chrome__read_page"
ToolSearch: "select:mcp__claude-in-chrome__resize_window"
ToolSearch: "select:mcp__claude-in-chrome__javascript_tool"
ToolSearch: "select:mcp__claude-in-chrome__read_console_messages"
ToolSearch: "select:mcp__claude-in-chrome__find"
```

**Standard screenshot workflow per page:**
1. `mcp__claude-in-chrome__navigate` → go to URL
2. `mcp__claude-in-chrome__computer` with `action: "screenshot"` → capture full page
3. `mcp__claude-in-chrome__read_console_messages` → check for JS errors
4. `mcp__claude-in-chrome__resize_window` → test responsive breakpoints
5. `mcp__claude-in-chrome__javascript_tool` → run accessibility/i18n checks

---

## 3. Global Checks (Run on EVERY Page)

For each page, verify ALL of the following:

### 3.1 Visual Integrity
- [ ] No broken layout (overflowing content, misaligned elements)
- [ ] No missing images (broken img src, empty `<img>` elements)
- [ ] Colors correct — primary purple palette, no gray/white placeholders
- [ ] Fonts loaded: Heebo/Assistant for Hebrew, Inter for English
- [ ] No horizontal scroll on desktop (1280px width)
- [ ] No overlapping elements

### 3.2 Hebrew RTL Rendering
- [ ] Text direction is RTL (right-to-left)
- [ ] Layout direction is RTL (sidebar on right, content flows right-to-left)
- [ ] Icons/arrows point in correct RTL direction (back arrow points RIGHT)
- [ ] Input fields aligned correctly (RTL text input)
- [ ] Numbers remain LTR within RTL context

**Quick RTL check via JS:**
```javascript
// Run in mcp__claude-in-chrome__javascript_tool
document.documentElement.dir === 'rtl' && document.documentElement.lang.startsWith('he')
```

### 3.3 Responsiveness
Test these breakpoints using `mcp__claude-in-chrome__resize_window`:
- Desktop: 1280 × 800
- Tablet: 768 × 1024
- Mobile: 390 × 844

Check: navigation collapses, touch targets ≥ 44px, no clipped content.

### 3.4 Accessibility
- [ ] Tab navigation flows logically (left-to-right in RTL = right-to-left visually)
- [ ] Focus states visible (outline/ring present)
- [ ] Buttons have accessible labels (aria-label or visible text)
- [ ] Images have alt text (especially AI-generated illustrations)
- [ ] Color contrast sufficient for child readers (large text, bright backgrounds)

**Quick a11y check via JS:**
```javascript
// Find images missing alt text
Array.from(document.images).filter(img => !img.alt).map(img => img.src)
```

### 3.5 i18n Hardcoded String Check
Look for hardcoded Hebrew text that should use `t()` keys.

**Red flags to search for:**
```javascript
// Run in mcp__claude-in-chrome__javascript_tool
// Find visible Hebrew text nodes (check if they're hardcoded)
Array.from(document.querySelectorAll('*'))
  .filter(el => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3)
  .filter(el => /[\u0590-\u05FF]/.test(el.textContent))
  .map(el => ({ tag: el.tagName, text: el.textContent.trim() }))
  .filter(item => item.text.length > 2)
  .slice(0, 20)
```

### 3.6 Console Errors
After every page load:
```
mcp__claude-in-chrome__read_console_messages
```
Expected: 0 errors, 0 warnings (minor React Query warnings acceptable)

---

## 4. Page-by-Page Review Plan

### Page 1: Landing Page (Public)
**URL:** `http://localhost:5173/welcome` (or `/` when logged out)
**Auth required:** No
**Priority:** CRITICAL (first impression, Creem compliance)

**What to check:**
- Hero section: headline, subheadline, CTA button — all in Hebrew RTL
- Stats section: numbers are real (no fake "families across the country" — REMOVED in Session 37)
- Features section: 3-4 feature cards with icons and descriptions
- Showcase section: book preview carousel with sample AI-generated books
- Pricing section: plan cards with correct pricing, no fake testimonials (REMOVED in Session 37)
- FAQ section: accordion opens/closes, Hebrew text wraps correctly
- CTA section: email signup or "get started" button
- Footer: `support@sipurai.ai` email visible with Mail icon (added in Session 37)
- No TestimonialsSection (was removed for Creem compliance)

**Known fixed:** Purple gradient on Home dashboard (may have also affected Landing hero)

---

### Page 2: Sign In
**URL:** `http://localhost:5173/sign-in`
**Auth required:** No
**Priority:** HIGH

**What to check:**
- Clerk UI renders in Hebrew (ClerkLocaleProvider wrapping)
- Google OAuth button visible and labeled in Hebrew
- Apple OAuth button visible (if configured)
- Email/password fields RTL-aligned
- Error messages in Hebrew
- "Sign up" link present and working

---

### Page 3: Sign Up
**URL:** `http://localhost:5173/sign-up`
**Auth required:** No
**Priority:** HIGH

**What to check:**
- All form fields RTL-aligned
- Hebrew labels on all inputs
- Password strength indicator (if present)
- Terms of Service and Privacy Policy links work
- Error messages localized

---

### Page 4: Home Dashboard
**URL:** `http://localhost:5173/` (when logged in)
**Auth required:** Yes
**Priority:** CRITICAL

**What to check:**
- Welcome card: greeting in Hebrew with user name
- Daily prompt card: shows today's creative prompt in Hebrew
- Featured books: at minimum 1-2 book cards with cover images
- Navigation sidebar (right side in RTL): all 8 items labeled correctly
- Gamification elements: XP bar, level badge, streak counter
- Quick action buttons: "צור ספר חדש" (Create New Book) prominent
- Images from Gemini (not Unsplash URLs — migrated in Session 37)

**Known fixed:** Purple gradient background was fixed in Session 37.

---

### Page 5: Book Wizard (CreativeStoryStudio)
**URL:** `http://localhost:5173/BookWizard`
**Auth required:** Yes
**Priority:** CRITICAL (main creation flow)

**What to check:**
- Progress bar visible at top, RTL direction
- Step 1 — Topic selection: genre/topic chips in Hebrew, filter tags localized
- Step 2 — Character selection: character picker placeholder in Hebrew (fixed Session 37)
- Step 3 — Style selection: style thumbnails with Hebrew labels
- Step 4 — Preview/Edit: 30+ strings should be i18n (fixed Session 37)
- Navigation buttons: "הבא" (Next), "קודם" (Previous) — arrows pointing correct RTL direction
- WizardProgress aria-labels in Hebrew (fixed Session 37)
- No hardcoded Hebrew strings in step headings/subtitles (TopicStep fixed Session 37)

---

### Page 6: Book Creation
**URL:** `http://localhost:5173/BookCreation` (or via wizard completion)
**Auth required:** Yes
**Priority:** HIGH

**What to check:**
- AI generation loading state — spinner/animation shows
- Generated story text renders RTL
- Illustration panels load (AI-generated images)
- Page navigation (previous/next page) works
- Hebrew story text wraps correctly (no overflow)
- Edit mode: text editing is RTL

---

### Page 7: Book View
**URL:** `http://localhost:5173/BookView` (pass a book ID)
**Auth required:** No (public books) / Yes (private)
**Priority:** HIGH

**What to check:**
- Book cover renders
- Page counter in correct format (Hebrew numerals or standard)
- Previous/Next page buttons: correct RTL direction (fixed in Session 37)
- Illustrations display without broken image icons
- Text overlay on illustrations is RTL
- Print/PDF export button visible and functional
- Share button present

---

### Page 8: Library
**URL:** `http://localhost:5173/Library`
**Auth required:** Yes
**Priority:** HIGH

**What to check:**
- Book cards grid: titles, cover images, genre/language tags
- Genre and language tags in Hebrew (fixed Session 37)
- Empty state (no books): Hebrew message with CTA
- Filter/sort controls in Hebrew
- "Create new book" CTA prominent

---

### Page 9: Characters
**URL:** `http://localhost:5173/Characters`
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Character cards with names and thumbnail images
- Empty state renders with Hebrew message and illustration
- Filter controls by type/style in Hebrew
- "Create character" button present
- Character image placeholders (should be AI-generated, not broken)

---

### Page 10: Character Editor
**URL:** `http://localhost:5173/CharacterEditor` (pass a character ID)
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Character name input: RTL-aligned
- Trait/style selectors: Hebrew labels
- Image generation: triggers correctly, shows loading state
- Save/Cancel buttons: Hebrew labels, correct positions (RTL)

---

### Page 11: Community
**URL:** `http://localhost:5173/Community`
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Book grid with shared community books
- Genre filter tags in Hebrew (fixed Session 37)
- Real stats, no fake numbers (verified in Session 37)
- Parent approval dialog: text in Hebrew (fixed Session 37)
- Like/comment interactions work
- Book cards show author name, genre, language

---

### Page 12: Community Post
**URL:** `http://localhost:5173/CommunityPost` (pass post ID)
**Auth required:** Yes
**Priority:** LOW

**What to check:**
- Book embed or preview renders
- Comments section RTL
- Share/Like buttons functional

---

### Page 13: Profile
**URL:** `http://localhost:5173/Profile`
**Auth required:** Yes
**Priority:** HIGH

**What to check:**
- XP progress bar with Hebrew label
- Level badge display
- Achievement badges grid — icons and Hebrew labels
- Stats tabs (books created, words written, etc.) in Hebrew
- Tab switching works without layout breaks

---

### Page 14: Leaderboard
**URL:** `http://localhost:5173/Leaderboard`
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Ranking table: positions, names, XP scores
- "אני" label on current user row (fixed Session 37 — was "את/ה")
- Hebrew book count strings i18n (fixed Session 37)
- Login prompt in Hebrew when logged out (fixed Session 37)
- Podium/top-3 display renders correctly

---

### Page 15: Story Ideas
**URL:** `http://localhost:5173/StoryIdeas`
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Genre filter chips in Hebrew
- Generated story ideas render in RTL text blocks
- "Generate" button labeled in Hebrew
- Loading animation during AI generation
- "Use this idea" CTA per generated idea

---

### Page 16: Settings
**URL:** `http://localhost:5173/Settings`
**Auth required:** Yes
**Priority:** MEDIUM

**What to check:**
- Language selector shows Hebrew/English/Yiddish options
- Toggle alignment — RTL toggle position (fixed Session 37)
- Audio settings section
- Notification settings
- Known issue: hardcoded ternaries still being migrated to i18n (in progress as of Session 37)

---

### Page 17: Blog
**URL:** `http://localhost:5173/blog`
**Auth required:** No
**Priority:** LOW

**What to check:**
- Blog post cards with titles, thumbnails, dates
- Hebrew text renders RTL
- Known issue: hardcoded Hebrew strings not yet migrated to i18n (in progress as of Session 37)

---

### Page 18: Contact
**URL:** `http://localhost:5173/Contact`
**Auth required:** No
**Priority:** LOW

**What to check:**
- Contact form: all fields RTL-aligned with Hebrew labels
- Submit button labeled in Hebrew
- Known issue: hardcoded translations still being migrated (in progress as of Session 37)
- `support@sipurai.ai` should be visible/linked

---

### Page 19: Privacy Policy
**URL:** `http://localhost:5173/privacy`
**Auth required:** No
**Priority:** LOW

**What to check:**
- Long-form Hebrew text renders cleanly RTL
- Section headings properly spaced
- No overflow or scroll issues on mobile

---

### Page 20: Terms of Service
**URL:** `http://localhost:5173/terms`
**Auth required:** No
**Priority:** LOW

Same checks as Privacy Policy.

---

### Page 21: Feedback
**URL:** `http://localhost:5173/Feedback`
**Auth required:** Yes
**Priority:** LOW

**What to check:**
- Feedback form fields in Hebrew
- Rating/star component works
- Submit confirmation message in Hebrew

---

## 5. Known Open Issues (From Session 37)

These were NOT yet fixed as of 2026-03-23:

| Component | Issue | Status |
|-----------|-------|--------|
| Contact page | Hardcoded translations → need i18n | In progress |
| Settings page | Hardcoded ternaries → need i18n | In progress |
| Blog/BlogPost | Hardcoded Hebrew → need i18n | In progress |
| RhymeOptions | Hardcoded labels → need i18n | In progress |
| TTSControls | Hardcoded strings → need i18n | Not started |
| PageStyler | Hardcoded strings → need i18n | Not started |
| TextOverlay | Hardcoded strings → need i18n | Not started |
| PageFlip | Hardcoded strings → need i18n | Not started |

**Remaining hardcoded string count:** ~30 (down from ~150)

---

## 6. Fix Workflow

When an issue is found:

1. **Document it** — note the page, component, and exact problem
2. **Find the source:**
   ```bash
   cd ~/projects/sipurai
   grep -r "hardcoded text" src/ --include="*.jsx"
   ```
3. **Fix the code** — follow existing patterns:
   - Hardcoded strings: use `const { t } = useTranslation()` then `t('key')` + add key to `src/components/i18n/languages/he.jsx`
   - RTL issues: use `dir="rtl"` on containers, `text-right` → `text-end` (logical CSS)
   - Broken images: check `src` URL, use local `/public/` assets or Gemini-generated images
4. **Verify fix:**
   ```bash
   npm run build  # Ensure clean build
   ```
5. **Re-screenshot the page** with Chrome MCP to confirm fix

---

## 7. Issue Log Template

Use this format to document each issue found:

```
## Issue #N
- **Page:** [page name]
- **URL:** [full URL]
- **Severity:** Critical / High / Medium / Low
- **Category:** Visual / RTL / i18n / a11y / Responsiveness / Error
- **Description:** [what is wrong]
- **Screenshot:** [attach or describe]
- **Fix:** [what was done to fix it]
- **Verified:** [ ] Yes / [ ] No
```

---

## 8. Final Verification Pass

After all fixes are applied:

1. Run build: `npm run build`
2. Run tests: `npx vitest run`
3. Do a second Chrome MCP pass through all CRITICAL and HIGH priority pages
4. Check browser console is clean (0 errors)
5. Update `PROGRESS.md` with QA findings and fixes

---

## 9. Chrome MCP Quick Reference

```javascript
// Navigate to page
mcp__claude-in-chrome__navigate({ url: "http://localhost:5173/Library" })

// Take screenshot
mcp__claude-in-chrome__computer({ action: "screenshot" })

// Check RTL direction
mcp__claude-in-chrome__javascript_tool({ script: "document.documentElement.dir" })

// Find broken images
mcp__claude-in-chrome__javascript_tool({
  script: "Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(i => i.src)"
})

// Find hardcoded Hebrew text
mcp__claude-in-chrome__javascript_tool({
  script: `Array.from(document.querySelectorAll('button,h1,h2,h3,p,label,span'))
    .filter(el => /[\\u0590-\\u05FF]/.test(el.textContent) && el.textContent.trim().length > 1)
    .map(el => el.textContent.trim())
    .slice(0, 30)`
})

// Check console errors
mcp__claude-in-chrome__read_console_messages({})

// Resize for mobile
mcp__claude-in-chrome__resize_window({ width: 390, height: 844 })

// Resize for tablet
mcp__claude-in-chrome__resize_window({ width: 768, height: 1024 })

// Resize for desktop
mcp__claude-in-chrome__resize_window({ width: 1280, height: 800 })

// Tab through interactive elements (accessibility)
mcp__claude-in-chrome__shortcuts_execute({ keys: "Tab" })
```
