# Sipurai UX overhaul: the plan

Date: 10.11.2026 · Version 3: includes the owner's answers to D1 to D8 · Depends on: AUDIT.md, VISION.md, DESIGN-DIRECTION.md, CRITIQUE.md · Execution contracts for phase 1 and the language track: `briefs/` · Repo `eladjak/sipurai`, production deploys from `main`.

## Ground rules for every pull request
1. **Small and shippable.** Each PR leaves production better, or (phase 1) leaves it exactly as it is.
2. **Phase 1 is invisible to production.** Everything new renders only when `VITE_NEW_SHELL === "true"`; with the switch off, every route, style, font download and string is as today (proven by a test in P1-06a). The switch flips only in PR 2.15. Rollback = switch off.
3. **The language track (I) does change production on purpose**, but only by fixing text: raw keys, wrong-language strings, English aria-labels. No layout or colour change.
4. **Branch and Vercel preview only.** No worker merges or deploys. The owner merges.
5. **Acceptance for every PR with anything a person sees:**
   - the wow checklist in DESIGN-DIRECTION.md (from `wow-ui-standard` and `impeccable`), answered item by item in the PR description;
   - 375px and 1280px screenshots of **every state** (empty, loading, error, success, limited, "?" open, reduced motion), produced by `scripts/ux/shoot.mjs` (P1-00), **looked at by a person or by a second engine**, and the written answer to "would we proudly show this?";
   - no horizontal overflow, no target under 44px, contrast AA (script); keyboard walk; `bun run build`, `bun run test` green; the type gate does not exceed the 295 baseline.
6. **Copy:** no new user-facing string outside the locale files (new strings go into the PR's own locale fragment, see `briefs/COMMON.md`).
7. **Product rules:** the print supplier is never named in the product; no payment path through Grow; no VAT wording.
8. **RTL and accessibility:** logical properties only; no new `flex-row-reverse` or `isRTL ? "left" : "right"`; `dir="ltr"` and the right input mode for phone, email, numbers and dates.

## Every route and screen, and the PR that brings it to the bar

Nothing is "later, unstyled". Old screens keep working on the old shell until PR 2.15 flips the switch; the language track fixes their text before that.

| Today | Screen | Target | Brought to the bar by |
|---|---|---|---|
| `/` (guest) | Landing | `/` | 3.1 personal sample, 3.2 landing polish |
| `/welcome` | Landing (always) | `/welcome` | 3.1, 3.2 |
| `/` (signed in) | Home dashboard | `/` הלילה | 2.3 (old home text fixed now by I-05e) |
| `/Dashboard`, `/Home`, `/LandingPage` | legacy | redirect to `/` | P1-06a |
| `/sign-in/*`, `/sign-up/*` | Clerk | same | P1-05 (flag), 3.2 |
| `/BookWizard`, `/StoryIdeas` | 6-step wizard, idea generator | `/new` (ideas inside the flow) | 2.4, 2.12 |
| `/BookView?id=` | Reader (parent and public) | `/book/:id` (parent view) and `/book/:id/read` (child layer) | 2.1, 2.6 (old reader text: I-05c) |
| `/Library` | Library | `/shelf` | 2.6 (old: I-05f) |
| `/Characters`, `/CharacterEditor` | Characters | `/heroes`, `/heroes/:id` | 2.8 (old: I-05f) |
| `/Profile`, `/Settings` | Profile, 6-tab settings | `/parents/*` | 2.9, 2.10, 2.11 |
| `/Contact`, `/contact` | mailto form | `/help/contact` (really sends) | 2.9 |
| `/Accessibility`, `/accessibility` | statement | `/help/accessibility` | 3.3 (text: I-05d) |
| `/Pricing`, `/pricing` | plans | `/pricing` (public) and `/parents/plan` | 3.2, 2.9 |
| `/Blog`, `/blog`, `/BlogPost`, `/blog/:slug` | blog | `/blog`, `/blog/:slug` | 3.3 |
| `/PrivacyPolicy`, `/privacy` | policy | `/privacy` | 3.3 (text: I-05d) |
| `/TermsOfService`, `/terms` | terms | `/terms` | 3.3 (text: I-05d) |
| `/BookCreation`, `/Feedback` | advanced editor, per-book suggestions | `/studio/:bookId` (notes tab) | 5.1, 5.2 (old text: I-05b) |
| `/Community`, `/CommunityPost` | public community | hidden; replaced by the family link | 4.1 hides; 2.7 family link |
| `/Leaderboard` | leaderboard | removed, redirect to `/` | 4.1 |
| `/book/:id/order` (flag) | print checkout | `/book/:id/print` | 2.13 (text: I-05a) |
| `/orders` (flag) | my orders | `/parents/orders` | 2.13 (text: I-05a) |
| `/admin/print-orders` (flag) | admin fulfilment tool | same | 2.14 (text: I-05a) |
| unknown URL | today redirects to sign-in | `NotFound` | P1-05 (flag) |
| `/__ui` (new, flag) | component gallery | dev only | P1-04 |
| `/__checkout-states`, `/__privacy-gate` | dev harnesses | dev only | updated with 2.13 and 2.9 |
| `/share/:token` (new) | family link page | guest view of one book | 2.7 |
| `/help` (new) | help centre | | 2.9 |
| `/studio/:bookId`, `/studio/new` (new) | creator studio | | 5.1, 5.2 |

**Screens and systems without their own route:**

| Surface | Brought to the bar by |
|---|---|
| Entry splash (`index.html`) | kept; wordmark and timing checked in P1-03b |
| Privacy consent gate (`ConsentScreen`) | 2.9 (restyle only; legal text unchanged) |
| Onboarding wizard (first sign-in) | replaced by the first-day state of 2.3 and the hero step of 2.4 |
| App shell, tab bar, side rail, top bar | P1-06b |
| Toasts, dialogs, tooltips, empty states, error boundary, friendly error | P1-03a, P1-03b (text: I-05d) |
| Gamification overlay and celebrations | 4.1 (becomes the star moment) |
| Install prompt (PWA) | 2.3 |
| Notification bell | removed from the new shell in P1-06b; back only with a defined job |
| FAQ chat on the landing | 3.2 |
| Gift-edition and order buttons | 2.13 |
| Book PDF export and the print PDF | 2.13 (layout, typography, cover) |
| Family-link preview card (social preview image) | 2.7 |
| Auth emails (Clerk) and receipts | 3.4 (Clerk branding is a dashboard change by the owner; receipts via the existing invoicing service) |
| Language picker, Yiddish beta badge | I-04a, I-04b |
| Assistive suggestion chips | 2.12 |

## Phases

Hours are estimates of worker time including tests and screenshots, not measurements.

### Phase 1: design system and shell, invisible to production (42 hours)
Nine contracts in `briefs/` (P1-00 to P1-06a). Result: on a preview with `VITE_NEW_SHELL=true` the app runs inside the new four-tab shell with the new tokens, fonts, primitives, 404 and themed sign-in; existing pages render inside the new shell under the new addresses. With the switch off, production is unchanged.

### Track I: language, in parallel (44 hours)
Eleven contracts in `briefs/` (I-01 to I-05f). Result: no raw keys anywhere (fallback), no used-but-missing keys in he and en, a CI ratchet that blocks new hard-coded strings and ternaries, Yiddish hidden and then returned as beta after a model translation with two reviewing models, and the long-living screens (print, studio base, reader, legal, home, library and characters) cleaned of ternaries and English aria-labels. Screens that phase 2 replaces (old wizard, settings, profile, community, leaderboard, story ideas) are not cleaned; the fallback covers them until they are removed.

### Phase 2: core screens on the new shell (158 hours)

| PR | What | Hours |
|---|---|---|
| 2.1 | **Night reader** (`a-read.html`): big separate previous/next, play/pause, replay, dots, word highlight, adult exit, restricted surface, keeps today's building/paused/missing-art states. **Gate:** 10-minute child test (3-4 and 5-6) | 15 |
| 2.2 | **Persistence:** device vs account; reading position and "who reads" on the account; drafts from the first choice; visible save failure | 8 |
| 2.3 | **הלילה** (`a-home.html`): who reads, continue, favourite, quieter new story with gift count, star collection, first-day state replacing onboarding, install prompt | 9 |
| 2.4 | **New story, 3 steps + writing theatre:** cost line; queued/slow/disconnected/partial/failed states; no charge on failure; duplicate guard; per-page skip/edit/report/replace; time to first page measured; real cost of a short story measured (feeds D8) | 20 |
| 2.5 | **Story safety:** age per reader, sensitivities wired into the request, report row | 6 |
| 2.6 | **המדף:** covers grid, filters, book sheet | 7 |
| 2.7 | **Family link** (decision 3): explicit per book, preview of exactly what is shared, unguessable token, expiry, revoke, list of links, `noindex`, social preview card, guest page `/share/:token`, tested signed-out | 10 |
| 2.8 | **הגיבורים:** list and editor, optional photo with verified copy, approve and correct the look | 9 |
| 2.9 | **הורים and help:** readers and roles, plan and gift, orders link, language and look, account, consent screen restyle, help centre, a contact form that really sends (server route plus email through the existing provider), accessibility page link | 14 |
| 2.10 | **Parental controls, rebuilt** (decision 6): research (what parents need, what other apps do, what we can enforce), spec with a second-engine critique, then build on the account: content level, blocked topics, age range, daily limit, who may create, approval before sharing. **Acceptance: for each control, a test that saves it and proves the request or the screen changes** | 16 |
| 2.11 | **Creation settings, rebuilt** (decision 6, the old "AI studio" tab): default story language, narration on/off and speed, default length and style, suggestions on/off; model and provider choice only under "פרטים מתקדמים" for power users, only for models tested end to end, with cost shown. Same acceptance rule | 10 |
| 2.12 | **Assistive suggestions layer** (decision 8b): rule engine plus chips in the new-story flow and the reader's end screen; cost on the chip; at most 3; off switch; tests per rule | 14 |
| 2.13 | **Print and export:** checkout at `/book/:id/print` (size moved here), orders, gift-edition button, book PDF and print PDF layout | 12 |
| 2.14 | **Admin print tool** to the same bar (owner-only, still wow) | 6 |
| 2.15 | **Switch flip:** new shell default; full walk on preview with the test account; Codex review; second-engine design critique | 2 |

### Phase 3: first minute and public pages (29 hours)
| PR | What | Hours |
|---|---|---|
| 3.1 | **Personal sample before sign-up** (decision 4): browser-only, `sessionStorage` hand-off, honest sentence, network log proves nothing leaves, analytics events checked for the name | 10 |
| 3.2 | Landing polish (Hebrew wordmark, remove the fake "E D C B A" avatars, duplicate stat, FAQ chat), pricing (one title, nav, brand button, RTL arrow), sign-in finishing | 6 |
| 3.3 | Blog, privacy, terms and accessibility pages to the bar (featured-card clipping fixed) | 8 |
| 3.4 | Emails and receipts look (owner sets Clerk branding; we supply the design), family-link preview image | 5 |

### Phase 4: removals and clean-up (10 hours)
4.1 leaderboard removed, XP becomes stars, community hidden (5) · 4.2 Base44 leftovers and dead components (3) · 4.3 old shell removed one release after the flip (2).

### Phase 5: the creator studio (30 hours)
5.1 spec with research and a second-engine critique (4) · 5.2 build on `BookCreation.jsx` and `bookCreation/*`: page board, per-page regenerate, shot size, angle, expression and light, hero model sheets as references, style picker with real examples, narration voice, rhyme, layout, print preview, the per-book notes tab that replaces `/Feedback` (26).

### Track V: illustrations and identity (12 hours)
Empty-state spots, night-sky set, star collection, deckled page motif, a hero model sheet sample; tokens tested against 12 real generated covers before they are locked; look consistency tested across ages, skin tones, hair, disabilities and several heroes.

### Reviews and QA (24 hours)
Strong model looks at every PR's screenshots and decides design questions; Codex reviews every diff and the experience; Grok or Antigravity gives an independent design critique after phase 2 and after phase 3; `/rams` and `impeccable` audits at the end of phases 2 and 3.

### Total
| Part | Hours |
|---|---|
| Phase 1 | 42 |
| Track I | 44 |
| Phase 2 | 158 |
| Phase 3 | 29 |
| Phase 4 | 10 |
| Phase 5 | 30 |
| Track V | 12 |
| Reviews and QA | 24 |
| **Total, every screen to the bar** | **349** |

With three to four workers in parallel (never more than five sessions on the machine), elapsed working time is roughly 110 to 130 hours, plus waiting for the test account, the child test and the owner's merges.

## The team: who does what

| Work | Worker or engine | How it is invoked |
|---|---|---|
| Design decisions, reading every screenshot, contract writing, synthesis | Strong model (main session) | — |
| Bounded implementation of one contract | Sonnet agent, one contract per run | `Agent` with `model: "sonnet"`, given `briefs/COMMON.md` and its contract |
| Mechanical scans and counts (i18n audit, grep inventories) | Haiku | `Agent` with `model: "haiku"` |
| Adversarial review of every PR diff and its screenshots | Codex on the server | `/opt/shared/ask-engine -t 1200 -f <brief> codex` |
| Yiddish translation pass (I-04b) | Codex in build mode, inside its own worktree | `ask-engine -w <worktree> codex` |
| Yiddish review | Antigravity (Gemini) and Grok, independently | `ask-engine agy`, `ask-engine grok` |
| Independent design critiques (after phases 2 and 3) | Grok or Antigravity on the preview | `ask-engine` |
| Illustrations | Codex image generation on the subscription, then `illustration-check` | — |

Concurrency: at most four implementation workers at once, each owning only its files (`briefs/README.md` has the ownership matrix); private temp folders; never `git commit -F` a shared path. Two failed attempts at the same step: the worker stops and returns its evidence.

## Decisions

**Answered by the owner on 10.11.2026:** D1 direction A · D2 leaderboard out, stars in · D3 community hidden, family link in phase 2 · D4 personal sample before sign-up, browser-only · D5 Yiddish by model pass plus two reviewing models, beta · D6 dead settings removed and rebuilt as real features · D7 short addresses with redirects · D8 the cap always covers 5 short stories, maybe more, plus the suggestions layer.

**Answered on 10.11.2026 (second round):** D9 add the sample sentence, no re-consent · D10 remove supplier and processor brand names from the policy, describe categories, offer the full list on request, flag any place the law may require a name (contract I-05d, flagged list in `data/policy-processor-names.md`) · D11 Hebrew terms binding, note for English and Yiddish users · D12 the Yiddish beta label comes off only after a native reader checks the 50 most-seen strings; the model pass goes ahead meanwhile.

**The original questions, kept for the record:**

**D9. One sentence in the privacy policy for the personal sample.** Proposed text for section 2 (Hebrew) and its English twin: *"**בדף הבית, לפני הרשמה:** אפשר להקליד שם כדי לראות ספר לדוגמה. השם נשאר רק בדפדפן שלכם, לא נשלח אלינו ולא נשמר."* / *"On the home page, before signing up, you can type a name to see a sample book. The name stays in your browser only; it is not sent to us and not stored."* Options: (a) add it without changing the policy version, because nothing new is collected, so parents are not asked to re-approve; (b) add it and bump the version. **Recommendation: (a).** If undecided: the sample still ships, the on-screen sentence carries the promise.

**D10. The print supplier is named in the public privacy policy.** The product rule says users never see the supplier's name, but `privacyPolicyContent.js` lists *"ספק ההדפסה BookPod"* (and the English version names it too). Options: (a) describe it as "ספק הדפסה בישראל" and keep the name in internal records only; (b) keep the name because a processor list should be specific. **Recommendation: (a)**, after a short check that a category is enough under Israeli privacy law (we are not lawyers; the file itself says it was not reviewed by one). If undecided: the name stays visible on `/privacy`.

**D11. Terms of service in English.** The terms page is Hebrew-only (58 inline lines). Machine-translating a legal text is a legal decision. Options: (a) English and Yiddish users see the Hebrew terms with a sentence explaining that the Hebrew version governs; (b) we translate and you approve. **Recommendation: (a)** now.

**D12. A native Yiddish reader before the beta badge comes off** (see "Where we think a decision is risky" below). Options: (a) beta stays until one native reader checks the 50 most-seen strings; (b) beta stays indefinitely on model review alone. **Recommendation: (a)**, whenever such a reader is available; no deadline.

## Where we think a decision is risky
- **Yiddish from models alone (D5).** Yiddish is a low-resource language for current models, and the readers who choose it are exactly the ones who will notice clumsy or wrong-dialect text. Two reviewing models are not a native reader, and the spelling convention (the standard YIVO spelling used in today's file, or the Hasidic spelling many Yiddish-speaking families read) has not been decided. The plan follows the decision (model pass, two reviewers, beta badge), adds the spelling question to I-04b, and proposes D12.
- **"No full name or photo" in the family link (D3).** It holds for the account and for uploaded photos, but the book itself contains the child's first name and an illustrated likeness. That is the point of the book, so the plan says it openly in the share preview rather than promising the recipient sees no personal details.
- **"Maybe more than 5" free stories (D8).** The approved monthly shared budget is $100. More free stories per account means fewer accounts covered before the cap stops creation for everyone. We measure the real cost of a short story in PR 2.4 and bring a number, not an assumption.

## Blocked
- **Test account** on production or a preview environment with a test user: one child hero, two books, credentials through the secure route. Needed for every signed-in screenshot and for PR 2.15.
- **Child test** for the night reader (PR 2.1): 10-minute sessions with children aged 3-4 and 5-6, run by the owner or family with a short script we prepare.
- **Verification of privacy copy** before PR 2.8 and 3.1 ship: what the drawing service keeps, and an access-rule check that heroes and books are invisible to other accounts.
- **Clerk branding** for emails (3.4) is a dashboard setting only the owner can change.
