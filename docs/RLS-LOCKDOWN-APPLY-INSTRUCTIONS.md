# Sipurai RLS Lockdown — Apply Instructions

**Production blocker.** All 11 core tables currently allow `anon` to read child PII
and DELETE/UPDATE any row (`USING(true)` policies from Phase 3). This runbook
locks them down. **Read the whole file before running anything.** Do not run the
migration in isolation — it must be sequenced with a code fix and a data backfill,
or logged-in users get locked out of their own data.

- Project: **furviizyohryyqubosut** (Sipurai PROD) — NOT the bayit project the
  Supabase MCP is currently pointed at (`uqumzjmyejlhoyliyesu`).
- Files:
  - Migration: `scripts/migrations/2026-05-25-rls-lockdown.sql`
  - Negative test: `scripts/rls-negative-test.mjs`

---

## The core finding: email vs Clerk-sub ownership mismatch

| Layer | What it uses as the owner identity |
|------|-------------------------------------|
| **DB rows today** | `created_by = user.email` (set by `src/lib/secureEntity.js` line 34: `[ownerField]: user.email`) |
| **Supabase JWT (Clerk)** | `sub` claim = **Clerk user id** (e.g. `user_2abc...`), surfaced to RLS as `auth.jwt()->>'sub'` |
| **New RLS policies** | key writes on `created_by = auth.jwt()->>'sub'` (Clerk id) |

So the column stores an **email**, but the policy compares against a **Clerk id**.
If you apply the migration without fixing both code and data, every existing row
fails the policy and users lose access to their own books.

**Safest path = fix all three in this order: code → backfill → migration → test.**

---

## Step 0 — Re-point the Supabase MCP (one-time, optional but recommended)

The MCP is on the bayit project. To use MCP tooling against Sipurai, start a fresh
session after:

```
claude mcp remove supabase -s user   # if the bayit one is registered at user scope
claude mcp add --scope user --transport http supabase \
  "https://mcp.supabase.com/mcp?project_ref=furviizyohryyqubosut"
```

Then `/mcp` to OAuth. **You can skip MCP entirely** and just use the Supabase SQL
editor (below) — that is the simplest safe path and avoids touching the bayit MCP.

---

## Step 1 — Fix the code so NEW rows store the Clerk id

In `src/lib/secureEntity.js`, ownership is written from `user.email`. Change the
`create` to stamp the Clerk id, and align the update/delete owner checks.

`User.me()` returns `{ id: clerkUser.id, email, ... }` (see `src/entities/User.js`),
so `user.id` is the Clerk `sub`.

```js
// create:
return entity.create({ ...data, [ownerField]: user.id });   // was user.email
```

For `update`/`delete`, the existing guard already accepts `owner === user.id`, so
it keeps working. **Exceptions** (do NOT blindly switch these to `user.id`):

- `Notification` uses `ownerField: 'user_email'` → keep writing the **email**
  (recipient is identified by email). The RLS policy for notifications keys on
  `auth.jwt()->>'email'`, not `sub`.
- `UserBadge` uses `ownerField: 'user_id'` → confirm what the app writes there
  (it should be the Clerk id). The badge policy keys on `user_id = sub`.
- `Follow` rows: `created_by` becomes the Clerk id; `follower_email` /
  `following_email` stay emails.

> The negative test and policies assume `created_by` = Clerk id for
> books/pages/characters/story_ideas/feedback/collaborations/community/comments.

**Build + deploy this code change so production writes Clerk ids going forward.**

---

## Step 2 — Backfill existing rows (email → Clerk id)

The DB has no email→id map; **Clerk is the only source of truth**. Claude did
**not** guess any values.

1. Export Clerk users (Clerk Dashboard → Users → export, or Backend API
   `GET https://api.clerk.com/v1/users`). You need each user's `id` + primary email.
2. For each user, run the UPDATE block at the bottom of the migration file
   (`-- DATA BACKFILL`), substituting the real `user_REALCLERKID` and email.

If prod has little/no real data, **Option B** in the migration (count rows, then
`TRUNCATE`) is faster and cleaner. Run the count query first:

```sql
SELECT 'books' t, count(*) FROM books
UNION ALL SELECT 'pages', count(*) FROM pages
UNION ALL SELECT 'characters', count(*) FROM characters
UNION ALL SELECT 'community', count(*) FROM community
UNION ALL SELECT 'comments', count(*) FROM comments
UNION ALL SELECT 'story_ideas', count(*) FROM story_ideas
UNION ALL SELECT 'feedback', count(*) FROM feedback;
```

> Backfill BEFORE the migration if you want zero downtime, or right after — but
> users will be locked out of old rows in the window between migration and backfill.

---

## Step 3 — Confirm the Clerk JWT template emits the claims the policies need

The policies depend on the **Supabase JWT template** in Clerk
(`getToken({ template: 'supabase' })`):

- `sub` → Clerk user id. **Always present** (default). Used by most policies.
- `email` → **NOT in Clerk's default template.** The `notifications` and `follows`
  policies need it. Add to the Clerk `supabase` JWT template:

  ```json
  { "email": "{{user.primary_email_address}}" }
  ```

If you do not add `email`, notifications read/update and follow reads will return
nothing for everyone. **Decision needed — see below.**

Also confirm the template's signing matches what Supabase expects for this project
(Clerk↔Supabase native integration, or a shared JWT secret). If auth was already
working end-to-end before, this is already correct.

---

## Step 4 — Apply the migration

**Supabase SQL editor (simplest):**
1. Open the **furviizyohryyqubosut** project → SQL Editor.
2. Paste the full contents of `scripts/migrations/2026-05-25-rls-lockdown.sql`.
3. Run. It is wrapped in a transaction and is idempotent (safe to re-run).

**Or Supabase CLI:**
```
supabase link --project-ref furviizyohryyqubosut
supabase db execute -f scripts/migrations/2026-05-25-rls-lockdown.sql
```

---

## Step 5 — Run the negative test

```bash
# anon-only (core security assertions — no token needed):
node scripts/rls-negative-test.mjs

# full run incl. authed scoping (recommended):
CLERK_JWT="$(grab from browser: await window.Clerk.session.getToken({template:'supabase'}))" \
CLERK_USER_ID="user_xxx" \
node scripts/rls-negative-test.mjs
```

### Expected results (all PASS)

| Check | Expectation |
|------|-------------|
| [1] anon SELECT core tables | 0 rows (or 4xx) — no owner data leaks |
| [2] anon SELECT books PII | 0 rows — child_name/age/family hidden |
| [3] anon DELETE core tables | 0 deleted |
| [4] anon INSERT books | rejected (401/403) |
| [5] anon SELECT community public | **works** (intended public browse) |
| [6] anon SELECT private community | 0 rows |
| [7] authed SELECT own tables | only own rows, 0 foreign |
| [8] authed UPDATE foreign book | rejected / nothing changed |

`RESULT: N passed, 0 failed` and exit code 0 = fix verified.

If [7]/[8] are skipped, you didn't pass `CLERK_JWT`/`CLERK_USER_ID` — fine for a
quick anon-only smoke, but run the full version before calling it done.

---

## Rollback

If logged-in users are locked out (almost always = backfill/code not done), you
can temporarily restore open access by re-running the original permissive block
from `scripts/setup-supabase-tables.sql` (lines 178-195). **This re-opens the
hole** — only use as an emergency stopgap, then fix and re-apply the lockdown.

```sql
-- EMERGENCY ONLY — reverts to insecure open RLS:
DO $$ DECLARE tbl TEXT; pol RECORD; BEGIN
  FOR tbl IN SELECT unnest(ARRAY['books','pages','characters','community',
    'comments','collaborations','feedback','story_ideas','user_badges',
    'follows','notifications']) LOOP
    FOR pol IN SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY "allow_select" ON %I FOR SELECT TO anon, authenticated USING (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_insert" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_update" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', tbl);
    EXECUTE format('CREATE POLICY "allow_delete" ON %I FOR DELETE TO anon, authenticated USING (true)', tbl);
  END LOOP;
END $$;
```

There is no schema/data change in the lockdown (only policies + two helper
functions + grant revoke), so rollback is policy-level only.

---

## DECISIONS NEEDED (Elad)

These are encoded as the *safest* default in the migration but you should confirm:

1. **Public books / sharing model.** `BookView` is a PUBLIC route (`src/App.jsx`
   `PUBLIC_PAGES`), so anon opens shared book links. `books` has **no** share/public
   flag. The migration makes a book anon-readable **iff** it has a public
   `community` post (`community.book_id` + `visibility='public'`). 
   - If you share books **outside** the community (direct link, no community post),
     those links will break. The clean fix is `ALTER TABLE books ADD COLUMN
     is_public boolean DEFAULT false;` + set it in the share flow + base the public
     policy on it. **Confirm which sharing model you want.**

2. **Clerk JWT `email` claim.** Add `{"email":"{{user.primary_email_address}}"}`
   to the Clerk `supabase` JWT template, or notifications + follows reads return
   nothing. (Yes/no — if no, those features stay broken under RLS.)

3. **Community `likes` by visitors.** Non-owners can no longer bump `likes`
   (it's an UPDATE on someone else's row). If visitor likes must persist, that
   needs a `SECURITY DEFINER` rpc `increment_like(post_id)`. Not built here.

4. **Notification creation.** A user creates notifications FOR others
   (recipient email ≠ author). Recipient-only INSERT can't be satisfied
   client-side. Migration allows author-creates-by-`created_by` as a stopgap;
   the right fix is server-side/`SECURITY DEFINER`. Confirm appetite.

5. **Feedback visibility to book owners.** Currently feedback is readable only by
   its author. If a book owner must read feedback left on their book, that needs a
   cross-table policy (`feedback.book_id` → `books.created_by`). Confirm.

6. **Leaderboard read role.** `user_badges` is readable by any authenticated user
   (for the leaderboard). If the leaderboard must work for anonymous visitors,
   change that policy's role to include `anon`.

7. **Collaborator access.** A collaborator seeing "books shared with me" needs an
   extra policy on `collaborations.collaborator_id`. Currently owner-only.
