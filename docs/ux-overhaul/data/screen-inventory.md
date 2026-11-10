# Sipurai screen inventory (code-based UX audit)

Source: local copy `scratchpad/sipurai-src/` (src/, CLAUDE.md, PROGRESS.md) plus read-only server look at `e2e/`, `docs/`, `api/`, `scripts/`. Date 2026-11-10. No builds, no browser. Every finding is file:line or a grep count. "unverified" marks what I did not confirm.
Paths below are relative to `src/` unless noted. Greps run from the repo root; counts are occurrences (`grep -o | wc -l`) over `src/**/*.jsx|js` incl. `components/ui/` unless noted.

## 0. Shape of the app

- Routing: `App.jsx` registers every entry of `pages.config.js` `PAGES` (22 entries) as `/<PascalCase>` (App.jsx:~160), plus `/`, `/welcome`, `/sign-in/*`, `/sign-up/*`, `/blog`, `/blog/:slug`, `/privacy`, `/terms`, `/accessibility`, and flag-gated `/book/:id/order`, `/orders`, `/admin/print-orders` (`VITE_PRINT_ORDER_ENABLED`, App.jsx:22-24,181-185), harnesses `/__checkout-states`, `/__privacy-gate` (App.jsx:26-27,187-188), `*` = PageNotFound.
- Public (no sidebar): `PUBLIC_PAGES` = BookView, LandingPage, Blog, BlogPost, PrivacyPolicy, TermsOfService, Contact, Pricing, Accessibility (App.jsx:48). Everything else is behind Clerk auth inside `LayoutWrapper`.
- Page files: 29 in `pages/` (13,699 lines). Files > 800 lines: BookWizard 1338, BookView 1247, BookCreation 893, Profile 829 (Community 790, Settings 775 just under).
- Shell: `Layout.jsx` (422 lines). Sidebar sections defined at Layout.jsx:122-143.

---

## 1. Per-route sections

### / (Home dashboard; guests see LandingPage) - `pages/Home.jsx` (418)
- Components: `onboarding/OnboardingWizard`, `home/UserWelcomeCard`, `home/DailyPromptCard`, `home/DraftBooksSection`, `home/FeaturedBooksSection`.
- Purpose: logged-in dashboard: welcome + XP, daily story prompt, drafts, featured books. Primary user: parent (and power user). Reached: nav "ראשי" (Layout.jsx:124), logo, `/Dashboard`-style legacy redirects (App.jsx:147).
- STRONG: draft section reuses real data (`DraftBooksSection`); daily prompt is cached (`getDailyPrompt`, Home.jsx:117); lazy-loaded page (pages.config.js:7).
- WEAK: guest fallback name is English literal `"Guest"` (Home.jsx:62,164,413) shown in Hebrew UI; fires an LLM call for the daily prompt from the dashboard (Home.jsx:117 `InvokeLLM`) - cost/latency on the first screen; 9 language ternaries (grep per-page); 7 ad-hoc gradients.
- DEAD/FAKE: 3 hard-coded English sample books `isSample: true` ("The Dragon's Quest", "Ocean Explorers", "Stars and Dreams", Home.jsx:76-101) used as "featured" fallback; initial `userData` stats are zero defaults (level 1, xp 0, Home.jsx:62-70).
- A11Y/RTL: `isRTL` physical pair x1 (grep), `flex-row-reverse` x2.
- PERF: `<img>` without `loading=` repo-wide: 33 of 36 (see section 3).

### /welcome and / for guests - `pages/LandingPage.jsx` (44) + `components/landing/*` (14 files)
- Purpose: marketing landing (Hero, Stats, Features, Showcase with `data/demoBooks.js`, WhyUs, HowItWorks, Pricing, FAQChat, CTA, Footer). Primary: new parent. Reached: guest `/`, direct `/welcome`.
- STRONG: demo books are clearly demo content from a data file (`data/demoBooks.js`, imported only by `landing/ShowcaseSection.jsx:6`); FAQ is a chat widget (`FAQChat`).
- WEAK: `StatsSection.jsx:39,55` shows the value 18 twice (labels both `landing.stats.artStyles`, lines 8 and 24 of the excerpt) - duplicate stat; `LandingNav.jsx:84` English aria-label "Sipurai - Go to homepage".
- DEAD: `landing/FAQSection.jsx` (104) and `landing/TestimonialsSection.jsx` (236) never imported (section 2).
- A11Y: in-page anchors `#showcase` (HeroSection.jsx:155), `#how-it-works` (ShowcaseSection.jsx:136) are valid anchors, not dead links.

### /sign-in, /sign-up - `pages/SignIn.jsx` (45), `SignUp.jsx` (38)
- Clerk components. Purpose: auth. 1 gradient each (SignIn.jsx, SignUp.jsx). Clerk locale via `components/ClerkLocaleProvider.jsx`. Unverified: Hebrew Clerk strings coverage.

### /BookWizard - `pages/BookWizard.jsx` (1338) - see section 7 for step-by-step
- Components: `wizard/TopicStep` (610), `PreviewEditStep` (714), `PrintSizeStep`, `SaveStep` (257), `WizardProgress`, `bookCreation/ScenePlanStep` (513).
- Purpose: create a book in 6 steps. Primary: parent. Reached: nav "יצירה > יצירת ספר" (Layout.jsx:127), Home, DailyPromptCard.
- STRONG: draft autosave and resume (`saveDraft`, BookWizard.jsx:187-230,282); progress copy "step N of 4" + page counts during generation (BookWizard.jsx:596-783); celebration after create (BookWizard.jsx:~127); "Surprise me" auto-fill (PreviewEditStep.jsx:243-284,347-373).
- WEAK: step 5 label is a language ternary not an i18n key `isRTL ? "גודל" : "Size"` (BookWizard.jsx:334); structure step label has a manual fallback ternary with Yiddish `"סטרוקטור"` (BookWizard.jsx:324-327); `PrintSizeStep.jsx:7,9` hard-coded he/en ternaries and raw `text-gray-900`; `PrintSizeStep.jsx:11` radio `absolute top-4 right-4` (physical); BookWizard.jsx:1338 lines in one file.
- DEAD/FAKE: none found in handlers. `gamification.awardXP(...).catch(() => {})` swallows errors (BookWizard.jsx:863-864).
- A11Y: radio inputs in PrintSizeStep have a `legend.sr-only`; `PreviewEditStep` fields have aria-label (lines 363,395,417,431).

### /BookCreation ("Advanced editor") - `pages/BookCreation.jsx` (893)
- Components: `bookCreation/*` (14 files: BookEditorTab, BookStylingTab, DraftView, GenerationSteps, PageImageEditor, PageLayoutEditor, PageNavigation, PagePreview, PageStyler, PageTextEditor, RhymeOptions, ScenePlanStep, ShareOptions, AutoSaveIndicator), `ai/TextOverlay`.
- Purpose: edit an existing/draft book page by page; tabs editor / preview / share (BookCreation.jsx:822,865,886). Primary: power user. Reached: nav "עורך מתקדם" (Layout.jsx:128), BookCard menu (library/BookCard.jsx:170,276), Draft/Featured cards.
- STRONG: `useAutoSave` + `AutoSaveIndicator`; tab structure is clear.
- WEAK: overlaps with the wizard's PreviewEditStep; named "Advanced editor" in the nav but is also where drafts land; 6 ternaries, 4 gradients, 2 `flex-row-reverse`; `BookEditorTab.jsx:99,105` `isRTL ? "ml-2" : "mr-2"` instead of logical `ms/me`; `ArrowLeft` used for "back" (BookEditorTab.jsx:99, DraftView.jsx:58) - check flips (unverified).
- PERF: 893 lines.

### /BookView - `pages/BookView.jsx` (1247)
- Components: `bookReader/PageFlip`, `TTSControls`, `GiftEditionCTA`, `checkout/OrderBookButton`.
- Purpose: read a book with page flip, TTS, zoom; guest allowed (PUBLIC_PAGES). Primary: child/parent. Reached: Library/Home cards, share links.
- STRONG: arrow keys honour RTL (BookView.jsx:383-411); print-order CTA wired to flag (`OrderBookButton`); back arrow flips with `isRTL` (BookView.jsx:627,649).
- WEAK: 19 language ternaries (grep) + 8 physical `isRTL` pairs + `text-right` x8 (BookView.jsx:515,528); 13 gradients; 23 purple/indigo utilities; guest banner text mentions "XP" (`he.jsx:863-867` "קבל XP", "קיבלת +25 XP").
- A11Y: English aria-labels "Zoom out" / "Zoom in" (BookView.jsx:793,805).
- PERF: 1247 lines; zoom state only 1-2x (BookView.jsx:79,435).

### /Characters - `pages/Characters.jsx` (393)
- Purpose: list/search/filter characters, grid or list view. Primary: parent. Reached: nav (Layout.jsx:129), wizard step 2.
- STRONG: skeleton loading with `aria-busy` (Characters.jsx:122); real entity data (`Character`).
- WEAK: English aria-labels "Grid view"/"List view" (Characters.jsx:235,244); `isRTL ? 'right-3' : 'left-3'` (Characters.jsx:187,192), `text-right` (168), `flex-row-reverse` (167,175); `text-gray-*` 13; hero banner uses `bg-white text-purple-700` (Characters.jsx:175).

### /CharacterEditor - `pages/CharacterEditor.jsx` (573)
- Components: `bookCreation`/`shared/CharacterPicker` (18 emoji, section 3), `profile/AvatarStudio` is NOT used here (dead, section 2).
- Purpose: create/edit a character (fields, avatar, traits). Primary: parent. Reached: Characters.jsx:174,282,325 (not in nav).
- WEAK: 16 language ternaries and 9 physical `isRTL` pairs (highest ratio of any non-Settings page); 7 gradients.
- A11Y: unverified labels; has AlertDialog for delete (import list).

### /Library - `pages/Library.jsx` (478)
- Components: `library/BookCard` (7 createPageUrl calls), Tabs, Select.
- Purpose: browse/search/sort own books, grid/list. Primary: parent. Reached: nav (Layout.jsx:132).
- STRONG: explicit `loadError` state (Library.jsx:51); search with clear button.
- WEAK: English aria-labels "Clear search" (265), "Grid view"/"List view" (360,367); 10 ternaries; `isRTL` physical x4; 19 purple/indigo.
- PERF: unbounded list? uses client-side `filteredBooks` over all `books` (Library.jsx:48-49) - unverified whether paginated.

### /Profile - `pages/Profile.jsx` (829)
- Components: `profile/MyBooksSection`, `FollowButton`, `gamification/BadgeDisplay`; Tabs overview/books/achievements/activity (Profile.jsx:520,670,695,711).
- Purpose: profile, XP bar, achievements, activity. Primary: parent/child. Reached: nav "הפרופיל שלי" (Layout.jsx:133), header avatar (Layout.jsx:377).
- STRONG: XP progress animated bar (Profile.jsx:328,444); level shown.
- WEAK: raw "XP" text (Profile.jsx:436,438,586); 21 gradients, 27 purple/indigo, 20 gray; 829 lines; overlaps with Settings account tab.
- FAKE: default stats zero, streak/badges from user fields (Profile.jsx:97-103,140-148) - real but empty for most users.

### /Community - `pages/Community.jsx` (790)
- Components: `components/community/*` (4), Dialog (approval), DropdownMenu.
- Purpose: shared stories feed, likes, sharing, parental-approval dialog (Community.jsx:298). Primary: parent. Reached: nav (Layout.jsx:136).
- WEAK: likes are stored in `localStorage` per user (Community.jsx:67-68,123,232) and the count is a read-modify-write `Community.update(postId,{likes:newLikeCount})` (Community.jsx:220-226) - race-prone, not a real per-user like table; 15 ternaries, 7 `flex-row-reverse`, 12 gradients, 33 purple/indigo (most of any page).
- PERF: 790 lines.

### /CommunityPost - `pages/CommunityPost.jsx` (566)
- Purpose: one post with comments. Primary: parent. Reached: community cards (components/community/CommunityPost.jsx:57,122,169,177) - not in nav.
- WEAK: 17 ternaries, 8 `flex-row-reverse`, 21 purple/indigo. Child-safety: public comments (unverified moderation beyond `moderateInput`, content-moderation.js).

### /Leaderboard - `pages/Leaderboard.jsx` (690)
- Purpose: rank users by XP / books / streak by period (weekly/monthly/allTime, Leaderboard.jsx:234-237). Primary: child/parent. Reached: nav only (Layout.jsx:137).
- STRONG: pagination, filter select, period buttons.
- DEAD/FAKE: not fake users, but XP of everyone except self is DERIVED: `userMap[creatorId].xp += 100` per book (Leaderboard.jsx:112), streak 0 and level 1 for others (Leaderboard.jsx:106-107). Real XP/streak only for the signed-in user (Leaderboard.jsx:122-123). Displays other users' names from `book.created_by_name` (Leaderboard.jsx:~100) = children's names in a public board (privacy review needed, unverified consent).
- WEAK: 18 gradients, 37 raw gray (highest), `flex-row-reverse` x7; 690 lines.

### /StoryIdeas - `pages/StoryIdeas.jsx` (606)
- Components: `storyIdeas/IdeaGenerator`, `IdeaForm`; `IdeaResult.jsx` is dead.
- Purpose: generate and save story ideas. Primary: parent. Reached: only via DailyPromptCard (home/DailyPromptCard.jsx:23); NOT in nav (near-orphan).
- WEAK: 16 ternaries; overlaps with wizard TopicStep (saved ideas, TopicStep.jsx:246-248) and "Surprise me".

### /Settings - `pages/Settings.jsx` (775) - see section 6
### /Pricing - `pages/Pricing.jsx` (60) + `landing/PricingSection`
- Purpose: plans (4 Creem plans, `lib/creem.js`). Primary: parent. Reached: footer (landing/FooterSection.jsx:9), quota card (shared/QuotaLimitCard.jsx:35), Settings billing; NOT in sidebar.
- WEAK: heading chain with ternary fallbacks `t(...) || t(...) || (isRTL ? 'מסלולים...' : '...')` (Pricing.jsx:20-23) hides missing keys; 6 ternaries in 60 lines.

### /Feedback - `pages/Feedback.jsx` (591)
- Purpose: per-book, per-page feedback/suggestions with accept/reject (Feedback.jsx:148-246). Primary: parent/collaborator. Reached: only from BookCard menu (library/BookCard.jsx:288); NOT in nav. Not the same as a product-feedback form.
- WEAK: 5 gradients, 19 purple/indigo; name collides with "Contact" for users hunting for support.

### /Contact - `pages/Contact.jsx` (330)
- Purpose: support form. Public. Reached: nav (Layout.jsx:141).
- DEAD/FAKE: the form does not send; it opens a `mailto:` in a new tab (Contact.jsx:80-83) and then shows a "submitted" screen (Contact.jsx:85-169). Stated honestly in a code comment, but the user sees success copy.
- WEAK: 9 ternaries; `isRTL` physical x5; email input type="email" without `dir="ltr"` (Contact.jsx:236).

### /Blog, /blog/:slug - `pages/Blog.jsx` (269), `BlogPost.jsx` (420)
- Components: `blog/BlogCard`, `BlogHeader`, `BlogSidebar`, `PortableText`; content from Sanity (`lib/sanityClient.js`, `hooks/useSanityContent.js`), static fallback `data/blogPosts.js` (93 Hebrew lines).
- Purpose: SEO content. Primary: new parent. Reached: footer; not in app nav.
- WEAK: `BlogHeader.jsx:61,67,73` physical `isRTL ? "right-3" : "left-3"` and `pr-9 pl-9`; BlogPost 7 ternaries, 16 raw gray.

### /privacy, /terms, /accessibility - `PrivacyPolicy.jsx` (118), `TermsOfService.jsx` (371), `AccessibilityStatement.jsx` (275)
- Purpose: legal. Reached: nav "הצהרת נגישות" (Layout.jsx:142), footer. TermsOfService has 58 inline Hebrew lines (not in i18n locales); privacy text in `data/privacyPolicyContent.js` (92 lines). 8-12 purple/indigo each.

### Print ordering (flag-gated) - `/book/:id/order` `PrintCheckout.jsx` (369), `/orders` `MyOrders.jsx` (91), `/admin/print-orders` `AdminPrintOrders.jsx` (277)
- Components: `checkout/*` (10), `lib/printOrder/*`.
- Purpose: order a printed book; admin fulfilment. Reached: BookView `OrderBookButton`; admin has no nav link (unverified role check: AdminPrintOrders.jsx:49,170 call `api.adminAction/adminList`, server must enforce).
- STRONG: dedicated Stepper, QtyStepper, address validation (`checkout/validation.js`), `dir="ltr"` on phone/zip (PrintCheckout.jsx:250,305; AddressForm.jsx:89).
- WEAK: hard-coded Hebrew in 36 lines of PrintCheckout and 35 of AdminPrintOrders (no i18n keys, so English/Yiddish UI sees Hebrew); `AddressForm.jsx:62` `type="tel"` without `dir="ltr"` (line 62-63).

### Harnesses (dev only) - `CheckoutStatesHarness.jsx` (102), `PrivacyGateHarness.jsx` (51)
- Flag-gated test pages (`VITE_CHECKOUT_HARNESS`, `VITE_PRIVACY_HARNESS`); keep, not user-facing.

### * - `lib/PageNotFound.jsx`; `components/UserNotRegisteredError.jsx` (see section 1B)

### 1B. Shell - `Layout.jsx` (422)
- STRONG: skip link `href="#main-content"` (Layout.jsx:217); sidebar sections grouped; mobile top bar (Layout.jsx:353); `GamificationOverlay` mounted once (Layout.jsx:10).
- WEAK: nav button uses `isRTL ? 'justify-end flex-row-reverse'` (Layout.jsx:49) and `isRTL ? 'right-0':'left-0'` (Layout.jsx:55); English aria-labels "Close sidebar" (236), "Open menu" (360), "View profile" (377); 15 ternaries; 27 raw gray; purple-to-indigo active state (Layout.jsx:51); appearance settings (dark mode, font, density) applied here from `user.*` (Layout.jsx:86,200-212).
- No bottom nav on mobile: only hamburger + sidebar (`lg:hidden`, Layout.jsx:353,403).

---

## 2. COMPONENT INVENTORY

Counts of non-test `.jsx` per folder under `components/` (command: `find src/components/<d> -name '*.jsx' ! -name '*.test.jsx' | wc -l`):
ui 32 · bookCreation 14 · landing 14 · checkout 10 (+ .js helpers) · profile 6 · shared 6 · ai 5 · storyIdeas 5 · wizard 5 · blog 4 · community 4 · feedback 4 · gamification 4 · home 4 · i18n 4 · social 3 · bookReader 3 · settings 3 · library 2 · privacy 2 · storyBuilder 2 · onboarding 1 · root files 3 (ClerkLocaleProvider, ErrorBoundary, UserNotRegisteredError). Total about 154 files.

Dead component files (command: for each non-ui `.jsx`, grep `from '...<Name>'` / `import('...<Name>')` across src excluding itself and tests; then grep the bare name):
1. `components/landing/FAQSection.jsx` (104 lines) - no import, no name reference
2. `components/landing/TestimonialsSection.jsx` (236)
3. `components/profile/AvatarStudio.jsx` (264)
4. `components/storyIdeas/IdeaResult.jsx` (201)
Dead UI primitives (no import of `components/ui/<x>`): `ui/alert.jsx`, `ui/table.jsx`, `ui/toggle-group.jsx` (3).
Total dead: 4 feature components + 3 primitives = 7 (805 lines in the 4 feature files). Verified with `grep -rn "<Name>" src` returning only the file itself. `components/ai/AIStudio.jsx` and `ModelSelector.jsx` ARE live but only via Settings.

Related stale: `lib/VisualEditAgent.jsx` (DEV only, Base44 editor protocol).

---

## 3. DESIGN-SYSTEM DRIFT (counts over `src/**/*.jsx|js`, occurrences)

Commands (`g(){ grep -rhoE "$1" src --include=*.jsx --include=*.js | wc -l; }`):

| Metric | Count | Command pattern |
|---|---|---|
| `bg-gradient-to-` | 278 | `g 'bg-gradient-to-'` |
| `from-purple` | 241 | `g 'from-purple'` |
| `to-indigo` | 209 | `g 'to-indigo'` |
| `gray-[0-9]` | 1493 | `g '\bgray-[0-9]'` |
| `slate-[0-9]` | 180 | |
| `purple-[0-9]` | 1459 | |
| `indigo-[0-9]` | 297 | |
| `pink-[0-9]` | 75 | |
| `amber-[0-9]` | 340 | |
| token classes `bg-primary` 11, `text-primary` 6, `text-muted-foreground` 19, `bg-background` 7, `bg-card` 1, `border-border` 2 | 46 total | |
| hard-coded hex colours in JSX/JS | 89 | `g '#[0-9a-fA-F]{6}\b'` |
| `clay-card` | 1 | `g 'clay-card'` |
| `<motion.` usages / files importing framer-motion | 258 / 57 | `grep -rl framer-motion src --include=*.jsx` |
| distinct font-size utilities | 11 (xs sm base lg xl 2xl 3xl 4xl 5xl 6xl 7xl); `text-sm` 377, `text-xs` 203 | `grep -rhoE "\btext-(xs\|sm\|...)\b"` |

Raw colours outnumber design tokens about 70 to 1 (3,800 raw gray/purple/indigo/amber/pink/slate vs 46 token uses). The brand is effectively "purple-600 to indigo-600" hard-coded everywhere (e.g. Layout.jsx:51, Settings.jsx tab at 442-449).

Top rounded variants (`grep -rhoE "\brounded(-[a-z0-9]+)?\b"`): rounded-full 202, rounded-xl 193, rounded-2xl 167, rounded-lg 51, rounded-md 46, rounded 23, rounded-3xl 20, rounded-sm 9. Three competing "card radius" values (xl, 2xl, 3xl).

Emoji as icons in JSX (script scanning `\u{1F300}-\u{1FAFF}` and `☀-➿`, excluding locales/tests): 86 occurrences. Examples: 📖 x7, 🎨 x4, ✨ x4, ⭐ x3, 🧙 🏰 😄 🌙 🧚 🌟 📚; concentrated in `shared/CharacterPicker.jsx` (18), `wizard/PreviewEditStep.jsx` (16), `onboarding/OnboardingWizard.jsx` (14), `pages/BookView.jsx` (7), `bookReader/TTSControls.jsx` (4), `landing/HowItWorksSection.jsx` (4).

Per-page raw ratios are in the per-route sections. Highest drift: Settings (19 gradients, 36 purple/indigo, 26 gray), Leaderboard (18, 12, 37), Profile (21, 27, 20), Community (12, 33, 9).

Image loading: 36 `<img` tags, 3 with a `loading=` attribute (`grep -rn '<img' src --include=*.jsx | grep -v test | grep -c 'loading='`).

---

## 4. GAMIFICATION surface

Source of truth: `hooks/useGamification.js` (XP_EVENTS: book_created 100, book_read 25, page_edited 10, character_created 50, community_share 30, streak_day 20, book_completed 50, first_login 10; LEVEL_THRESHOLDS 0..150000; badge definitions, bilingual). Writes to `User` and `UserBadge` entities - real persistence.

| Where | What | Real or mocked |
|---|---|---|
| `Layout.jsx:10` `GamificationOverlay` + `XPToast` + `CelebrationModal` | toast/confetti on XP | real (events from wizard/BookView: BookWizard.jsx:863, BookView last page) |
| `Home.jsx:62-70,165` + `home/UserWelcomeCard` + `BadgeDisplay` | level, XP bar, streak, badges | real from `user.*`, zero defaults for new users |
| `Profile.jsx:97-148,328,436,586` | XP bar, level, streak, achievements, XP rewards | real; achievement list is the static definitions with progress |
| `Leaderboard.jsx:106-133` | ranking | self real; others derived (100 XP per book, streak 0, level 1) - not their real XP |
| BookView guest banner, `he.jsx:863-867` | "קבל XP", "+25 XP" | copy only; guests get nothing |
| Landing `he.jsx:1605,1772` | marketing "נקודות XP, תגים, רצף יומי" | copy |

Findings: "XP" is shown raw in Hebrew UI (Profile.jsx:436,438,586; he.jsx:863-867,2354 "XP הורווח") - jargon for a parent. Leaderboard mixes real and synthesised numbers on one scale. Child names appear on a public board.

---

## 5. NAVIGATION MAP (Layout.jsx:122-143)

| Section | Item | Target | Exists / useful |
|---|---|---|---|
| ראשי | Home | `/` | yes, dashboard |
| יצירה | Create book | `/BookWizard` | yes, primary flow |
| יצירה | Advanced editor | `/BookCreation` | yes, but page needs a book id/draft; opening it empty is confusing (unverified) |
| יצירה | Characters | `/Characters` | yes |
| המרחב שלי | Library | `/Library` | yes |
| המרחב שלי | My profile | `/Profile` | yes; overlaps Settings |
| קהילה | Community | `/Community` | yes |
| קהילה | Leaderboard | `/Leaderboard` | exists; partly synthesised data |
| מערכת | Settings | `/Settings` | yes |
| מערכת | Contact | `/Contact` | mailto only |
| מערכת | Accessibility statement | `/Accessibility` | legal page in primary nav |

Pages NOT in nav: StoryIdeas (only via DailyPromptCard), CharacterEditor (via Characters), Feedback (only BookCard menu), Pricing (footer/quota card), CommunityPost, BookView, Blog, MyOrders (`/orders`, no link found in nav), AdminPrintOrders.

Overlap/duplication:
- BookWizard vs BookCreation vs StoryIdeas vs CharacterEditor: 3 ways to start a story (wizard topic step with "Surprise me"/saved ideas, StoryIdeas page, Home DailyPromptCard) and 2 editors (PreviewEditStep in wizard vs BookCreation). Characters can also be created inline in the wizard (`shared/CharacterPicker`).
- Profile vs Settings: both show account/avatar/identity; Profile also has overview/achievements.
- Community vs Leaderboard: two sidebar items for the social surface; Leaderboard is thin.
- Feedback vs Contact: name collision; Feedback is per-book collaboration comments, Contact is support. Neither is a visible "send feedback about the app".
- AI settings (AIStudio) vs wizard art-style: two places to choose style/model.

---

## 6. SETTINGS (`pages/Settings.jsx`, tabs defined at Settings.jsx:371-378; 6 tabs)

Persisted via `tempSettings` (Settings.jsx:265-268,304-307) to the `User` entity.

| Tab | Fields | Effective? |
|---|---|---|
| כללי (general) | `language` (UI), `default_story_language`, `audio_enabled`, `audio_speed`, `notifications_enabled` | `language`: yes (i18n; BookWizard reads user language, BookWizard.jsx:~330). `default_story_language`: SAVED, NEVER READ (grep in src: only Settings.jsx:498-500). `audio_enabled`, `audio_speed`: SAVED, NEVER READ (zero hits outside Settings; TTS keeps its own state in `useTTS`/`TTSControls`). `notifications_enabled`: SAVED, NEVER READ (`useNotifications.js` has no reference). |
| מראה (appearance) | `dark_mode`, `text_density`, `font_size` | all three read in `Layout.jsx:86,200-212` - live |
| סטודיו AI (ai) | `AIProvidersPanel` (image provider, TTS engine, TTS voice -> `localStorage` `sipurai_*`, read by `lib/aiProvider.js:241`), `AIStudio` model picker/credits | provider panel live. AIStudio: `currentModel={null}`, `onModelChange={() => {}}` (Settings.jsx:685) = picker does nothing; credits meter invents `credits_total ?? 100` (Settings.jsx:687); models not wired render "Coming soon" (ModelSelector.jsx:28-30,520) |
| חשבון (account) | name, email (display), manage subscription, logout, `AccountDataControls`, `DeleteAccountCard` | name/email read-only display (labels at Settings.jsx:715,719; email input `dir` unverified) |
| חיוב (billing) | plan card, Creem checkout | live (Settings.jsx:112,126-170) |
| בקרת הורים (parental) | `components/settings/ParentalControls.jsx`: PIN lock, `contentFilterLevel`, `allowAIGeneration`, `maxDailyBooks`, `allowCommunitySharing`, `requireApprovalBeforePublish`, `blockedTopics`, `ageRange` | stored in browser `localStorage` only (`content-moderation.js:332-353`), not per account/device. Read: `maxDailyBooks` (bookRateLimit.js:36), `allowCommunitySharing` + `requireApprovalBeforePublish` (ShareOptions.jsx:60-61, Community.jsx:298). SAVED, NEVER ENFORCED: `contentFilterLevel`, `allowAIGeneration`, `blockedTopics`, `ageRange` (only appear in the defaults object at content-moderation.js:319-325 and the form) |

Counts: settings never read = 4 general (`default_story_language`, `audio_enabled`, `audio_speed`, `notifications_enabled`) + 4 parental (`contentFilterLevel`, `allowAIGeneration`, `blockedTopics`, `ageRange`) = 8; plus 1 dead picker (AIStudio `onModelChange`). Confidence: grep-based, so a read via dynamic key would be missed (unverified).
UX: 45 language ternaries, 17 physical isRTL pairs, 21 `flex-row-reverse`, 19 gradients (highest in app); labels in UPPERCASE `tracking-wide` (Settings.jsx:~471,621,648,715) do nothing in Hebrew; tab labels hidden on mobile (`hidden sm:inline`, Settings.jsx:450) leaving 6 icon-only tabs. "Save" is a page-level button (batch save), so toggles do not apply until saved.

---

## 7. WIZARD (BookWizard), step by step

Steps (BookWizard.jsx:329-336): topic -> characters -> structure -> preview -> size -> save (6).

| # | Step | What the parent decides | Required? |
|---|---|---|---|
| 0 | Topic (`TopicStep`) | pick a topic tile, OR "Surprise me", OR custom idea textarea (TopicStep.jsx:531), OR saved idea (TopicStep.jsx:550-587) | yes (canGoNext, BookWizard.jsx:357) |
| 1 | Characters (`CharacterPicker`) | choose >= 1 character | yes (line 358) |
| 2 | Structure (`ScenePlanStep`) | edit AI scene-by-scene outline (title, role, description, characters) | optional (line 359); triggers outline generation on Next (BookWizard.jsx:381) |
| 3 | Preview/Edit (`PreviewEditStep`) | title (required, line 360), description, moral, story language, art style grid, story length (short/medium/long), rhyming toggle (+ rhyme settings), "advanced": tone (5 options), age range (4), moral detail; "Surprise me" re-rolls style/length/tone/age; "new idea" reset | title only |
| 4 | Size (`PrintSizeStep`) | print size radios (even if the parent never prints) | always passes |
| 5 | Save (`SaveStep`) | review cards (topic, title, characters, style, length), press Create | - |

Decisions before the first story appears: minimum **4 forced taps/entries** (topic, >=1 character, title, Create) with defaults for everything else (defaults at BookWizard.jsx:146-165: art_style "disney", length "medium", age "5-7", tone "exciting", language from profile). Maximum visible decision groups: **about 12** (topic, characters, scene edits, title, description, moral, language, art style, length, rhyme, tone, age, print size). Print size is shown to everyone although print is flag-gated.
Where waiting is shown: `creationProgress` state (BookWizard.jsx:127) rendered by `SaveStep` via magic labels ("step N of 4", "pages ready x/y", BookWizard.jsx:596,640,695-783; SaveStep.jsx:11-32,188-195) with a percent; outline wait shows `preparingStory`/`aiCrafting` copy in PreviewEditStep.jsx:293-315. After pages stream in, the app hands off to the reader while generation continues (`handedOffRef`, BookWizard.jsx:~133).
Problems: "Advanced" fields hidden behind a toggle but still counted; step 2 (structure) and step 3 overlap (both edit story content); "Size" label is ternary-hard-coded (BookWizard.jsx:334); no child-facing mode (child_name/age/gender are state defaults, BookWizard.jsx:160-163, set where? unverified).

---

## 8. BASE44 LEFTOVERS (cross-cutting)

Greps: `grep -rniE 'base44' src` = 14 lines (section below); `CLAUDE.md` 2; `PROGRESS.md` 55; server: `e2e/legacy-base44/` (3 files, 7 hits), `docs/archive/GAPS-AND-REQUIREMENTS.base44-era-2026-02-27.md` (12), `scripts/setup-supabase-tables.sql` (1), `README.md` (>=1).

| # | Path | What | Live? | Action |
|---|---|---|---|---|
| 1 | `src/lib/supabaseEntity.js:2,4,7,8,14,27,89,111` (8 comment lines) | adapter documented as "drop-in replacement for Base44 entities"; keeps Base44 sort syntax `"-field"` | live code, stale comments; API shape is still the Base44 shape | keep code, reword comments; rename later |
| 2 | `src/lib/supabaseClient.js:69` | comment "Matches Base44's UploadFile return shape" | live | reword |
| 3 | `src/integrations/Core.js:4,5` | header says "no Base44" | live | reword |
| 4 | `src/entities/User.js:59` | comment "same behaviour as Base44's auth.me" | live | reword |
| 5 | `src/components/onboarding/OnboardingWizard.jsx:190` | comment "Base44 may not support all fields" | live | delete comment |
| 6 | `src/test/setup.js:5` | guard against "Base44 SDK" leaked requests | test only | delete/reword |
| 7 | `src/lib/VisualEditAgent.jsx` + App.jsx:7-10,220 | Base44 visual-edit iframe protocol, DEV only | dead in prod | delete |
| 8 | `src/components/UserNotRegisteredError.jsx` + App.jsx:29,109-112 | English "Access Restricted ... contact the app administrator" screen; `authError.type === 'user_not_registered'` | unreachable: AuthContext.jsx:103,147 only ever sets `authError: null` | delete (and the App.jsx branch) |
| 9 | `isLoadingPublicSettings` (App.jsx:70,100; AuthContext.jsx:102,146 hard-coded false; pages/__tests__/pages-setup.js:20) | "app public settings" Base44 concept | dead flag | delete |
| 10 | `src/pages.config.js` registry + `__Layout` alias (pages.config.js:2,58) + header comment "(auto-generated)" in App.jsx | Base44 pages registry pattern; still the live router source | live | keep, rename `__Layout` -> `Layout`, drop "auto-generated" |
| 11 | `createPageUrl` (utils/index.ts:4; 115 call sites across src) | Base44 helper; PascalCase `/Library` URLs | live, pervasive | keep for now; plan a lower-case URL migration with redirects (also `/pricing` vs `/Pricing` case, App.jsx:92) |
| 12 | `src/entities/*` (14 files) + `createSupabaseEntity`/`createSecureEntity` | Base44 entity-wrapper pattern (`.list(sort, limit)`, `.filter()`); 55 imports of `@/entities` | live | keep; rename to repositories only if refactoring |
| 13 | `CLAUDE.md:22,40,42` | still describes `api/ -> Base44 client, entities, integrations`, "aliased from api/entities"; the `src/api` folder it mentions does not exist (`api/` at repo root is Vercel serverless: _lib, account, ai, books, cron, orders, payments, privacy, webhooks) | doc wrong | rewrite the structure block (line 8 itself says "RETIRED") |
| 14 | `CLAUDE.md:93` "Pages are registered in pages.config.js" | accurate but Base44 convention | live | keep |
| 15 | `PROGRESS.md` (55 lines) | history | doc | archive older sections |
| 16 | `e2e/legacy-base44/` (README, helpers/auth.js, navigation.spec.js) | old Playwright specs | dead | delete (or move to docs/archive) |
| 17 | `docs/archive/GAPS-AND-REQUIREMENTS.base44-era-2026-02-27.md` | archive | doc | keep archived |
| 18 | `scripts/setup-supabase-tables.sql` (1 hit) | comment | doc | reword |

Total distinct leftovers: 18 (14 source lines in src + 2 CLAUDE.md lines + e2e dir + archive doc + sql + README + registry patterns counted separately). Truly dead and safe to delete: #6-#9, #16 (5 items). `src/api` folder referenced in CLAUDE.md: does not exist (checked `ls src`: no `api/`).

---

## 9. A11Y / RTL / i18n cross-cutting numbers

- English `aria-label` in a Hebrew-first app: 17 (`grep -rnE 'aria-label="[A-Za-z]' src --include=*.jsx | grep -v test`): Layout.jsx:236,360,377; BookView.jsx:793,805; Characters.jsx:235,244; Library.jsx:265,360,367; AIProvidersPanel.jsx:66,87,103; LandingNav.jsx:84; ui/pagination.jsx:13,53,68.
- Physical left/right inside `isRTL ? ... : ...`: 127 lines (`grep -rnE "isRTL *\? *['\"\`][^'\"\`]*\b(left|right|ml-|mr-|pl-|pr-|text-right|text-left)"`); `flex-row-reverse` hacks: 156 lines. Tailwind logical utilities (`ms-`/`me-`) are used in only a few places (Layout.jsx:55 `ms-3/me-3`).
- Language ternaries (`isHebrew ?`, `isHe ?`, `isRTL ? "<Hebrew>"` or `language === 'hebrew' ?`): at least 80 (conservative regex); 1,089 lines containing Hebrew literals in 73 non-locale source files, largest: `utils/book-translations.js` 113, `data/blogPosts.js` 93, `data/privacyPolicyContent.js` 92, `pages/TermsOfService.jsx` 58, `OnboardingWizard.jsx` 54, `PreviewEditStep.jsx` 51, `TopicStep.jsx` 42, `PrintCheckout.jsx` 36, `AdminPrintOrders.jsx` 35.
- `div/span onClick` without role: 0 found (`grep -rnE "<(div|span|li|p)[^>]*onClick"`). Good.
- `href="#"` dead links: 0 (only in-page anchors).
- Empty handlers: only `Settings.jsx:685 onModelChange={() => {}}` and default props in `storyIdeas/IdeaForm.jsx:19-24`, `IdeaGenerator.jsx:15-16` (defaults, harmless).
- TODO/FIXME/"coming soon": `ai/ModelSelector.jsx:28,30`, `lib/smartModelPicker.js:14,21,166` (models shown as "Coming soon"), `lib/storyBible.js:18` TODO.
- Inputs: `type=email|tel|date` found: ShareOptions.jsx:382, AddressForm.jsx:62, Contact.jsx:236 - only AddressForm zip has `dir="ltr"` (AddressForm.jsx:89); no `type="date"` found. `dir="ltr"` appears 20 times overall.
- Arrows: 61 uses of Chevron/Arrow icons outside `ui/`; BookView flips explicitly (BookView.jsx:627,649); others unverified.
- Jargon in Hebrew UI: "XP" (he.jsx:863-867,1605,1772,2354), "קרדיטים" (he.jsx:1992,2242,2490), "AI Studio"/"סטודיו AI" tab (Settings tab `settings.tabs.ai`), model/provider names in AIProvidersPanel (grep: AIProvidersPanel.jsx 12 Hebrew lines; provider names like Gemini/OpenAI not verified as shown).
- Images: 36 `<img>`, 3 with `loading` (lazy).
- Tests exist for many hooks/components (`*.test.jsx`), good safety net for a redesign.

---

## 10. Ten highest-value findings

1. 8 settings are saved and never enforced: `default_story_language`, `audio_enabled`, `audio_speed`, `notifications_enabled` (Settings.jsx:265-268, no readers) and parental `contentFilterLevel`, `allowAIGeneration`, `blockedTopics`, `ageRange` (content-moderation.js:319-325 only). Parental controls live only in `localStorage` (content-moderation.js:332).
2. Settings "AI Studio" panel is decorative: `onModelChange={() => {}}`, invented 100-credit meter (Settings.jsx:685-687).
3. Design system is absent: 3,800 raw colour utilities vs 46 token uses; purple-to-indigo gradients 278x; 3 competing card radii.
4. i18n is half-done: 80+ language ternaries and 1,089 hard-coded Hebrew lines in 73 files; PrintCheckout/AdminPrintOrders/Terms are Hebrew-only.
5. RTL via hacks: 127 `isRTL ? 'left':'right'` lines, 156 `flex-row-reverse`; logical properties barely used.
6. Wizard has 6 steps and about 12 decision groups; print size is asked to everyone; 4 forced inputs minimum.
7. Gamification mixes real and synthesised data: leaderboard XP = 100 per book for others (Leaderboard.jsx:112); "XP" jargon raw in Hebrew; children's names on a public board.
8. Contact form does not send (mailto only, Contact.jsx:80-83) yet shows a success screen.
9. Base44 residue: dead `UserNotRegisteredError` (English, unreachable), `isLoadingPublicSettings`, `VisualEditAgent`, `e2e/legacy-base44`, stale CLAUDE.md structure block; 4 dead feature components (805 lines).
10. Navigation: StoryIdeas, Feedback, Pricing, MyOrders have no nav path; 3 ways to start a story; Profile vs Settings and Community vs Leaderboard overlap; mobile has only hamburger, no bottom nav; English aria-labels on the shell (Layout.jsx:236,360,377).

## 11. Not verified

Visual rendering, real mobile behaviour, Clerk Hebrew strings, whether Library is paginated, `child_*` field source in the wizard, AdminPrintOrders role enforcement (server side), dynamic-key settings reads, which arrows flip outside BookView.
