# Sipurai — Launch-Readiness Scorecard (2026-06-14)

Autonomous deep-work pass (team-build + safe-live-refactor). Prod stayed **200**, GEO stayed **100/100**. **No RLS / prod-Supabase data was touched.** The risky reconciliation is left **PR-ready**, not merged.

---

## Verdict: NOT launch-ready yet — ONE high-stakes blocker found that needs your decision + a preview deploy

The core kid's-book flow is well-built, but I found that **production `main` is out of sync with the already-applied production database**, in a way that breaks new users. Details below. This is the #1 item.

---

## 🚨 #1 BLOCKER — prod code (`main`) is out of sync with the prod DB (RLS applied 2026-05-25)

The Clerk-`sub` ownership migration was **applied to the prod Supabase DB on 2026-05-25** (RLS now keys ownership on `auth.jwt()->>'sub'` = the Clerk id, and the `notifications` table's `user_email` column was **dropped** and replaced by `recipient_id`). But the matching **code never reached `main`** — it got entangled with the unmergeable `feat/story-video-mvp` (Remotion) branch. So on `origin/main` (= production) right now:

- `secureEntity.create` stamps `created_by = user.email`, but prod RLS `WITH CHECK (created_by = current_clerk_id())` requires the Clerk **sub** → **new book/page INSERTs are rejected by Postgres for signed-in users.**
- All page reads filter `Book.filter({ created_by: user.email })` → a user's own Library/Home/Profile/Characters read as **empty**.
- The `Notification` entity still uses `ownerField: 'user_email'` — **a column that no longer exists in the prod DB.**

**Why I did not just fix it:** the correct code is the set of non-video commits on `feat/story-video-mvp` (`0d006c5`, `dde23af`, `8c50870`, …). Cleanly extracting them touches the RLS-coupled surface (profiles, follows, PII-safe views, Notification re-keying) whose safety depends on the **live** RLS state — exactly the prod-Supabase surface I was told not to destabilize, and a `tsc`-passing change here can still fail at runtime against the live policies. This needs a **Vercel preview deploy + a signed-in smoke test against prod RLS + the safe-live-refactor council** before it touches `main`.

**The fix path (for you / a focused session):**
1. Branch off `origin/main`, cherry-pick the non-video commits `0d006c5 dde23af 30cdf3a 09e78f2 8c50870 f3cea14` (only PROGRESS.md conflicts — code auto-merges; I verified this).
2. Exclude the Remotion video MVP (`src/remotion/*`, `remotion.config.js`, `render-sample-video.mjs`, `20260525120000_story_video_mvp.sql`) — "ship without it" per the 2026-05-25 audit.
3. Push → **Vercel preview** → sign in → create a book → confirm it saves AND shows in Library; check notifications/follows. (Vercel's atomic promotion means a bad preview never replaces prod.)
4. Council (behavior-preservation + RSC/runtime + RLS-consistency lenses) on the diff, then promote.

---

## What I fixed + verified this pass (safe, isolated, build-green — PR-ready, NOT yet merged to main)

Branch **`chore/launch-fixes-2026-06-14`** (pushed):
1. **`chat-faq` Hebrew truncation** — `gemini-2.5-flash` without `thinkingConfig.thinkingBudget:0` burns the whole token budget on hidden "thinking" → empty/truncated Hebrew answers. Set `thinkingBudget:0` + `maxOutputTokens 400→600`. (Was claimed deployed 2026-05-28 but is NOT on `main`.)
2. **P0-2 leaked `service_role` key** — removed the hardcoded service-role JWT from `scripts/setup-supabase-storage.mjs`; now reads `SUPABASE_SERVICE_ROLE_KEY` from env (exits if unset). **⚠️ You must still ROTATE that key in Supabase** — it's in git history and bypasses all RLS.

Branch **`chore/jspdf-v4-bump`** (pushed) — see jsPDF decision below.

**Verified:** `vite build` exit 0 on both branches · `vitest run src/lib/secureEntity.test.js` 21/21 · changes isolated to the named files · prod 200 + GEO 100 unaffected (nothing merged to main).

---

## jsPDF v2→v4 decision (you asked: is the bump safe to do now?)

**Decision: YES, safe — and I did it on a branch (`chore/jspdf-v4-bump`, build-green). But it's lower-priority than it looked, because the vuln isn't runtime-reachable here.**

- The advisory is a **moderate** DOMPurify XSS, transitive via `jspdf<=4.2.0`.
- **`sipurai/src/utils/pdfExporter.js` uses ONLY jsPDF primitives** (`new jsPDF` / `addImage` / `text` / `splitTextToSize`) — **no `.html()`, no `html2canvas`, no `dompurify` import anywhere in `src`.** So the vulnerable code path is never executed → the XSS was not actually reachable.
- The bump to **`jspdf@4.2.1`** clears the dompurify advisories, the `addImage`/`text` API is unchanged, and **`vite build` is green**. Only `package.json`/`package-lock.json` changed. Low risk → I committed it on its branch for you to merge (ideally after one real PDF-export smoke).
- (The remaining "3 high" audit items are the `esbuild`/`vite` dev-tooling advisory — separate, dev-only, needs a breaking `vite@8` bump. Out of scope.)

### ⚠️ Separate, bigger PDF finding (NOT the vuln): Hebrew export is broken
`pdfExporter.js` writes Hebrew `text_content` with jsPDF's **default Helvetica font and no RTL handling** → Hebrew renders as missing/garbled glyphs in the exported PDF. For a Hebrew kids'-book app this is a real core-feature defect. Fixing it = embed a Hebrew TTF (`doc.addFont`) + RTL/bidi the text + right-align. That's a focused feature (a few hours with a real export test), **not** a dep bump — flagged here, not rushed.

---

## Other launch-readiness notes (from the 2026-06-07 code audit, still open on `main`)
- **P1-2 Leaderboard** is broken (shows only the caller because RLS scopes `Book.list` to owner; `email.split("@")` yields a raw Clerk id as the name). The real fix sources from the sanitized `public_books` view / a leaderboard RPC + the `profiles` directory — **part of the #1 reconciliation**, not a standalone fix.
- **P1-1 Creem webhook HMAC** on `main` still signs over `JSON.stringify(req.body)` → all valid webhooks 401 → paid users stay `free`. The raw-body fix is on the video branch (`f3cea14`); pull it in with #1 (payments path — verify on preview).
- Core flow states (loading/error/empty) are present (`isLoading`, `loadError`, `EmptyState`, `Promise.allSettled` on image gen, abort timeouts). `verifyClerk` is fail-closed in prod. These are solid.

---

## Precise "before launch" checklist for Elad

1. **Reconcile `main` with the applied prod RLS** (the #1 blocker above) — branch + cherry-pick non-video commits + **Vercel preview + signed-in smoke** + council, then promote. Without this, new users can't create or see books.
2. **Rotate the Supabase `service_role` key** (was committed; my fix removes it from the file but not from history).
3. Merge **`chore/launch-fixes-2026-06-14`** (chat-faq + key removal) — safe, build-green.
4. Merge **`chore/jspdf-v4-bump`** after one real PDF-export smoke.
5. Pull in **Creem raw-body HMAC** (with #1) and verify a real webhook on preview before billing.
6. Fix the **Leaderboard data source** (with #1).
7. (Feature) Make the **Hebrew PDF export** actually render Hebrew (embed TTF + RTL) before promising "export your book".
8. Post-launch hardening: Clerk `user.created` webhook → service-role upsert into `profiles` (closes the email-squatting residual the council flagged).

---

## Honest assessment
Sipurai's UI and core creation flow are genuinely good, but it is **not launch-ready** because production code drifted out of sync with the production database — new signed-in users currently can't create or see their own books. That's a real, confirmed blocker, and fixing it correctly needs a preview deploy against the live RLS (your gate), not an autonomous prod merge. I shipped the two safe isolated fixes PR-ready, did + verified the jsPDF bump, and documented the rest precisely. The jsPDF *vuln* is a non-issue here (unreachable); the jsPDF *Hebrew export* is the thing actually worth a follow-up.
