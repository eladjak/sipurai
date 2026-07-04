# Sipurai - Project Instructions

## Project Overview
**Sipurai** (formerly EY.AI Kids Playground) - פלטפורמה מקיפה ליצירה, שיתוף והדפסת ספרי ילדים מותאמים אישית עם AI.
**Domain:** https://sipurai.ai | **Analytics:** https://analytics.sipurai.ai
הילד/ההורה בוחר דמויות, סגנון, שפה וז'אנר - וה-AI יוצר ספר שלם עם סיפור ואיורים.

## Tech Stack (updated 2026-07-05 — Base44 is RETIRED, do not reference it)
- **Frontend:** React 18 + Vite (JSX, not TypeScript)
- **Auth:** Clerk (`@clerk/clerk-react`) — prod instance clerk.sipurai.ai (pk_live), dev instance many-liger-29 (pk_test). ⚠️ The dev instance has NO 'supabase' JWT template → local dev cannot write to the DB (writes run anon and RLS blocks them).
- **DB/Storage:** Supabase `furviizyohryyqubosut` — RLS locked (2026-05-25): ownership keyed on Clerk `sub` via `auth.jwt()->>'sub'`; PII-safe public views (`public_books`/`public_pages`); `profiles` directory + SECURITY DEFINER RPCs for follows/notifications
- **Payments:** Creem (4 plans in `src/lib/creem.js`), webhook `api/webhooks/creem.js` (raw-body HMAC)
- **AI serverless:** `/api/ai/generate` (Gemini text/image + OpenAI image[-edit]), `/api/ai/tts` (OpenAI gpt-4o-mini-tts / Gemini), `/api/chat-faq` — all Clerk-JWT-gated (`api/_lib/verifyClerk.js`, fail-closed)
- **UI:** Radix UI + shadcn/ui + Tailwind CSS · **Animation:** Framer Motion
- **State:** React Query v5 · **Routing:** React Router v6 · **Icons:** Lucide
- **i18n:** Custom (Hebrew, English, Yiddish with RTL)
- **PDF:** jsPDF + Heebo TTF embed + bidi-js visual reordering (`src/utils/pdfExporter.js` + `src/utils/hebrewText.js`) — Hebrew works; test with `node scripts/verify-hebrew-pdf.mjs`

## Architecture
```
src/
  api/           → Base44 client, entities, integrations
  components/    → Reusable components by domain
    ai/          → AI Studio, Image Generator, Character Designer
    bookCreation/ → Book writing & illustration flow
    characters/   → Character cards & image generation
    collaborate/  → Collaborative editing
    community/    → Social features
    createBook/   → Book creation wizard steps
    feedback/     → Feedback system
    gamification/ → Achievements, badges, rewards
    home/         → Homepage components
    i18n/         → Internationalization
    interactive/  → Interactive story elements
    library/      → Book library
    profile/      → User profile & stats
    storyBuilder/ → Story structure builder
    storyIdeas/   → Idea generator
    ui/           → shadcn/ui primitives
  entities/      → (aliased from api/entities)
  hooks/         → Custom React hooks
  integrations/  → (aliased from api/integrations)
  lib/           → Auth, utils, navigation
  pages/         → Route pages (19 pages)
  utils/         → Utility functions
```

## Key Pages
| Page | Purpose |
|------|---------|
| Home | Dashboard with gamification, featured books, daily prompt |
| CreativeStoryStudio | Main book creation flow (unified) |
| BookCreation | Book writing & illustration process |
| BookView | Read/view completed books |
| Characters | Character library |
| CharacterEditor | Edit individual characters |
| Library | User's book library |
| Community | Shared books & social features |
| StoryIdeas | Story idea generator |
| Collaborate | Collaborative book editing |
| Leaderboard | Gamification rankings |
| Profile | User profile & achievements |
| Documentation | Work plan & roadmap (embedded) |

## AI Integrations (src/integrations/Core.js → src/lib/aiProvider.js → /api/ai/*)
- `InvokeLLM` — text generation (Story Bible pipeline in `src/lib/storyBible.js` — ONE structured call per book)
- `GenerateImage({ prompt, aspectRatio, modelId, referenceImageBase64 })` — illustrations. `referenceImageBase64` = character-consistency reference (cover image → every page), wired through BookWizard since 2026-07-05
- `synthesize()` (`src/lib/ttsProvider.js`) — cloud TTS with Hebrew narration presets (`NARRATION_PRESETS` in storyBible.js)
- `UploadFile` — Supabase Storage

## Current Development Phase
**Phase 1:** Story Structure Builder Integration (IN PROGRESS)
- Scene Cards UI complete
- Integration with CreativeStoryStudio needed
- Hebrew RTL support needed
- Scene sketch generation with story data needed

**Phase 2:** Character Integration + Community Prep
**Phase 3:** ShareHub (export to PDF/ePub/MP4, print integration)
**Phase 4:** AI Studio (multi-model selection)

## Development Rules
1. **Language:** Hebrew-first with English support. All UI must support RTL
2. **Child Safety:** All content must be age-appropriate. No scary/violent content
3. **Accessibility:** Large touch targets, clear fonts, high contrast
4. **Performance:** Image caching with localStorage, lazy loading
5. **Gamification:** XP, levels, badges, streaks integrated throughout
6. **AI Prompts:** Always include age range and language in AI prompts

## File Conventions
- JSX files (not TSX) - project uses JavaScript with JSConfig
- Components use default exports
- Pages are registered in `pages.config.js`
- Layout wraps all pages via `Layout.jsx`
- Shared UI from `components/ui/` (shadcn)

## Important Notes
- Entities live in `src/entities/*` and wrap `createSecureEntity(createSupabaseEntity(...))` — ownership stamped as `created_by = user.id` (Clerk sub). NEVER compare `created_by` to `user.email` (that regression killed the product for 6 weeks, fixed on `fix/prod-db-reconcile`)
- Demo showcase books: `src/data/demoBooks.js` + character-consistent artwork in `public/demo/` (regenerate: `node scripts/generate-demo-images.mjs` then `python scripts/compress-demo-images.py`)
- Gift-edition demand gate: `src/components/bookReader/GiftEditionCTA.jsx` — measurement only (Umami event + Feedback row `feedback_type='gift_edition_interest'`), NO payment until the demand gate passes
- Tests: vitest + @testing-library/react; 1 known OOM file (infra, not a regression). No TypeScript strict mode (jsconfig.json)
- Deploys: Vercel project `ey.ai-kids-playground`; previews are SSO-protected (bypass secret in `.vercel/bypass-secret.txt`, gitignored); branch domain `preview.sipurai.ai` bound to `fix/prod-db-reconcile` (needs a Cloudflare CNAME `preview` → `28aedb36648d9e52.vercel-dns-017.com` — Elad gate)
- E2E against live RLS: `scripts/e2e-newuser-prod-harness.mjs` (needs a fresh Clerk JWT) — proved 10/10 on 2026-07-05

---

## UI/Design Tools (MANDATORY - Feb 2026)

### Google Stitch MCP (USE FOR ALL UI WORK)
Before designing ANY UI component, page, or layout:
1. Use Stitch MCP tools: `build_site`, `get_screen_code`, `get_screen_image`
2. Generate designs in stitch.withgoogle.com first, then pull code via MCP
3. Use `/enhance-prompt` skill to optimize prompts for Stitch
4. Use `/design-md` skill to document design decisions
5. Use `/react-components` skill to convert Stitch designs to React

### Available Design Skills
- `/stitch-loop` - Generate multi-page sites from a single prompt
- `/enhance-prompt` - Refine UI ideas into Stitch-optimized prompts
- `/design-md` - Create design documentation from Stitch projects
- `/react-components` - Convert Stitch screens to React components
- `/shadcn-ui` - shadcn/ui component integration guidance
- `/remotion` - Create walkthrough videos from designs
- `/omc-frontend-ui-ux` - Designer-developer UI/UX agent

### Rule: NEVER design UI from scratch with Claude tokens. Always use Stitch MCP or v0.dev first!

## Design & Quality Stack (Feb 2026)

### Mandatory Design Workflow
1. **Stitch MCP** - Design screens BEFORE coding UI
2. **ReactBits** (reactbits.dev) - Animated interactive components
3. **shadcn/ui** - Base UI primitives

### Quality Gates (run before completing ANY UI task)
- React Doctor: `npx -y react-doctor@latest .` (security, perf, correctness, architecture)
- TypeScript: `bunx tsc --noEmit`
- Accessibility: check aria-labels, keyboard nav, focus states

### Animation Rules
- Framer Motion or CSS transforms only
- Max 200ms for feedback animations
- No width/height/top/left animations - use transform/opacity

---

## Agent Tools & MCP (חובה!)

### לפני כתיבת קוד
- **Context7 MCP**: `resolve-library-id` → `query-docs` - לבדוק API/syntax עדכני
- **Octocode MCP**: `githubSearchCode` - לחפש implementations אמיתיים ב-GitHub
- **DeepWiki MCP**: `ask_question` - לשאול על ריפו ספציפי

### לעבודת UI (אם רלוונטי)
- **Stitch MCP**: `build_site` / `get_screen_code` - לעיצוב לפני קוד
- **ReactBits**: reactbits.dev - קומפוננטות אנימטיביות

### בסיום כל איטרציה
1. עדכן PROGRESS.md עם מה שנעשה בפועל
2. הרץ בדיקות: `npx vitest run` (פרויקט JSX - אין tsc strict)
3. ודא build עובד לפני commit: `npm run build`
4. commit עם הודעה: `feat/fix/refactor: תיאור באנגלית`


---

## Iteration Protocol (MANDATORY)

This project follows the global iteration protocol:
- Reference: `~/.claude/rules/iteration-protocol.md`
- Update `PROGRESS.md` every 10-15 exchanges
- End every session with verification + HTML review
- Non-negotiable: PROGRESS.md must be updated before session ends
