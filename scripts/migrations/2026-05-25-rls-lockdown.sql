-- ============================================================================
-- Sipurai RLS Lockdown Migration
-- Project: furviizyohryyqubosut (Sipurai PROD)  — NOT the bayit MCP project
-- Date:    2026-05-25
-- Author:  security-fix (drafted for Elad review — DO NOT auto-apply)
-- ============================================================================
--
-- WHAT THIS FIXES
--   The Phase-3 schema (scripts/setup-supabase-tables.sql lines 178-195) created
--   fully permissive RLS on all 11 tables:
--       FOR SELECT/INSERT/UPDATE/DELETE TO anon, authenticated USING (true)
--   => Any anonymous visitor with the public anon key can READ every parent's
--      child PII (child_name, child_age, family_members) and can DELETE / UPDATE
--      ANY row in the database. Auth is enforced only client-side in
--      secureEntity.js, which is trivially bypassed by calling PostgREST directly.
--
-- OWNERSHIP MODEL (see "OWNERSHIP NOTE" below — READ BEFORE APPLYING)
--   Clerk issues a Supabase JWT (template 'supabase'); the user identifier is the
--   `sub` claim = Clerk user id (e.g. "user_2abc..."). Policies below key writes on
--       created_by = auth.jwt()->>'sub'
--   EXCEPT notifications (keyed on user_email = auth.jwt()->>'email') and
--   user_badges (keyed on user_id).
--
--   *** MISMATCH (MUST FIX IN CODE TOO) ***
--   Today src/lib/secureEntity.js writes  created_by = user.email  (NOT user.id).
--   So existing rows store an EMAIL in created_by, while the JWT sub is a Clerk id.
--   If you apply these policies WITHOUT (a) the code fix and (b) the data backfill,
--   logged-in users will be LOCKED OUT of their own existing rows.
--   => Apply order is in APPLY-INSTRUCTIONS.md. Do NOT run this file alone.
--
-- DESIGN
--   * `anon` (logged-out) is denied everything by default.
--   * Narrow public exceptions, each scoped, for the genuinely-public flows:
--       - community : anon may SELECT only rows with visibility = 'public'
--       - comments  : anon may SELECT only comments on a public community post
--       - books/pages: anon may SELECT only books shared to the community
--                       (see "PUBLIC BOOKS" decision flag below)
--       - user_badges: authenticated may SELECT all (leaderboard) — flag below
--   * Owners (authenticated, matching id claim) get full CRUD on their own rows.
--
-- This migration is IDEMPOTENT: it drops the old permissive policies by name and
-- recreates the new ones. Safe to re-run.
-- ============================================================================

BEGIN;

-- ── 0. Helper: current Clerk user id from the Supabase JWT ───────────────────
-- auth.jwt() is provided by Supabase (GoTrue/PostgREST). For a Clerk-minted JWT
-- the subject is in ->>'sub'. We wrap it so policies stay readable and so a
-- future claim change is a one-line edit.
CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')
$$;

CREATE OR REPLACE FUNCTION public.current_clerk_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(lower(auth.jwt() ->> 'email'), '')
$$;

-- ── 1. Drop ALL existing permissive policies on the 11 core tables ───────────
-- The Phase-3 setup created policies named allow_select/allow_insert/allow_update/
-- allow_delete. We drop those plus any same-named ones from prior re-runs.
DO $$
DECLARE
  tbl  TEXT;
  pol  RECORD;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'books','pages','characters','community','comments','collaborations',
      'feedback','story_ideas','user_badges','follows','notifications'
    ])
  LOOP
    -- Drop every existing policy on the table (clean slate, name-agnostic).
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
    -- Ensure RLS is ON. We do NOT FORCE: the Supabase `service_role` (used by
    -- server routes like api/webhooks/creem.js via SUPABASE_SERVICE_ROLE_KEY)
    -- must keep its RLS bypass for legitimate server-side writes. The anon and
    -- authenticated roles (the browser) are fully gated by the policies below.
    -- If you ever want even service_role gated, add FORCE ROW LEVEL SECURITY,
    -- but then every server write needs an explicit policy.
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Revoke any blanket grants to the anon role left over from setup. RLS already
-- gates row access, but removing table-level privileges is defense-in-depth.
-- (PostgREST still needs SELECT/INSERT/UPDATE/DELETE granted to `authenticated`.)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- IMPORTANT: PostgREST returns 401 for a role with NO table privilege BEFORE it
-- ever evaluates RLS. So an intended-public READ policy for `anon` is useless
-- unless `anon` also holds the base SELECT grant. Re-grant table-level SELECT to
-- `anon` ONLY on the tables that have an anon public-read POLICY below
-- (community, comments, books, pages). RLS still narrows the rows `anon` sees to
-- the public subset (visibility='public' / community-shared). NO write grants —
-- anon keeps zero privilege on the other 7 tables (verified: HTTP 401).
GRANT SELECT ON public.community TO anon;
GRANT SELECT ON public.comments  TO anon;
GRANT SELECT ON public.books     TO anon;
GRANT SELECT ON public.pages     TO anon;

-- ============================================================================
-- 2. OWNER-ONLY TABLES (no public read)
--    books*, pages*, characters, story_ideas, feedback, collaborations
--    *books/pages get an ADDITIONAL narrow public-read policy in section 3.
-- ============================================================================

-- ── characters ───────────────────────────────────────────────────────────────
CREATE POLICY "characters_owner_select" ON public.characters
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "characters_owner_insert" ON public.characters
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "characters_owner_update" ON public.characters
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "characters_owner_delete" ON public.characters
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- ── story_ideas ──────────────────────────────────────────────────────────────
CREATE POLICY "story_ideas_owner_select" ON public.story_ideas
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "story_ideas_owner_insert" ON public.story_ideas
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "story_ideas_owner_update" ON public.story_ideas
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "story_ideas_owner_delete" ON public.story_ideas
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- ── feedback ─────────────────────────────────────────────────────────────────
-- FLAG: feedback has a `privacy` column ('public'|'private') and is read in
-- Feedback.jsx by book_id. As drafted, only the feedback AUTHOR can read their
-- own feedback. If a book OWNER must read all feedback left on THEIR book, that
-- needs a cross-table policy (book_id -> books.created_by). Left owner-only here
-- pending Elad's decision — see DECISIONS NEEDED in APPLY-INSTRUCTIONS.md.
CREATE POLICY "feedback_owner_select" ON public.feedback
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "feedback_owner_insert" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "feedback_owner_update" ON public.feedback
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "feedback_owner_delete" ON public.feedback
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- ── collaborations ───────────────────────────────────────────────────────────
-- FLAG: collaborations link a book owner (created_by) to a collaborator
-- (collaborator_id / collaborator_email). As drafted only the creator (book
-- owner) can read/write the collaboration row. A collaborator seeing "books
-- shared with me" would need an additional policy keyed on collaborator_id =
-- current_clerk_id(). Left owner-only pending decision.
CREATE POLICY "collaborations_owner_select" ON public.collaborations
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "collaborations_owner_insert" ON public.collaborations
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "collaborations_owner_update" ON public.collaborations
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "collaborations_owner_delete" ON public.collaborations
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- ============================================================================
-- 3. BOOKS + PAGES  (owner-only write; owner read + narrow public/shared read)
-- ============================================================================
--
-- PUBLIC BOOKS DECISION (Elad must confirm — see APPLY-INSTRUCTIONS.md):
--   src/App.jsx marks `BookView` as a PUBLIC page (anonymous visitors open shared
--   book links). But `books` has NO is_public / shared flag. Sharing today relies
--   on the wide-open RLS we are removing.
--
--   This migration ties "publicly viewable" to the EXISTING community share:
--   a book is anon-readable IFF there is a row in `community` for that book with
--   visibility='public'. Pages of such a book are likewise anon-readable.
--   This is the SAFEST interpretation that does not invent a new column or expose
--   private drafts.
--
--   If Elad wants a dedicated share toggle independent of community, the cleaner
--   long-term fix is: ALTER TABLE books ADD COLUMN is_public boolean DEFAULT false;
--   then base the public-read policy on books.is_public. That is a separate,
--   app-coordinated change (the share flow must set the flag) — NOT done here.

-- books: owner full CRUD
CREATE POLICY "books_owner_select" ON public.books
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "books_owner_insert" ON public.books
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "books_owner_update" ON public.books
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "books_owner_delete" ON public.books
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- books: public read of community-shared books (anon AND authenticated).
-- Scoped to books that have a public community post.
CREATE POLICY "books_public_shared_select" ON public.books
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community c
      WHERE c.book_id = books.id
        AND c.visibility = 'public'
    )
  );

-- pages: owner full CRUD (ownership inherited via created_by on the page row,
-- which secureEntity stamps the same way as books).
CREATE POLICY "pages_owner_select" ON public.pages
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());
CREATE POLICY "pages_owner_insert" ON public.pages
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "pages_owner_update" ON public.pages
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "pages_owner_delete" ON public.pages
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- pages: public read of pages belonging to a community-shared book.
CREATE POLICY "pages_public_shared_select" ON public.pages
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community c
      WHERE c.book_id = pages.book_id
        AND c.visibility = 'public'
    )
  );

-- ============================================================================
-- 4. COMMUNITY  (public read of public posts; owner-only write)
-- ============================================================================
-- Community.jsx queries Community.filter({ visibility: 'public' }) for anon
-- browsing, and { is_featured: true }. Both are covered by the public-read of
-- visibility='public'. "my-posts" (filter by user_id) is covered by owner read.

-- Public read: anyone (incl. anon) may read posts marked public.
CREATE POLICY "community_public_select" ON public.community
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

-- Owner read: a logged-in user can always read their own posts (any visibility).
CREATE POLICY "community_owner_select" ON public.community
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());

-- Owner write.
CREATE POLICY "community_owner_insert" ON public.community
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "community_owner_update" ON public.community
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "community_owner_delete" ON public.community
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());
-- NOTE: `likes` increments are an UPDATE by non-owners today (client-side).
-- Under this policy a non-owner can no longer bump `likes` directly. If like
-- counts must work for visitors, that needs a SECURITY DEFINER rpc (e.g.
-- increment_like(post_id)) — FLAGGED in APPLY-INSTRUCTIONS.md. Not added here.

-- ============================================================================
-- 5. COMMENTS  (public read of comments on public posts; owner-only write)
-- ============================================================================
-- CommunityPost.jsx / Community.jsx read Comment.filter({ community_id }).
-- Anon viewing a public post must see its comments.

CREATE POLICY "comments_public_select" ON public.comments
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community c
      WHERE c.id = comments.community_id
        AND c.visibility = 'public'
    )
  );

CREATE POLICY "comments_owner_select" ON public.comments
  FOR SELECT TO authenticated
  USING (created_by = public.current_clerk_id());

CREATE POLICY "comments_owner_insert" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "comments_owner_update" ON public.comments
  FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id())
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "comments_owner_delete" ON public.comments
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());

-- ============================================================================
-- 6. FOLLOWS  (follower owns the row; reads scoped to involved users)
-- ============================================================================
-- ownerField is created_by (the follower). follower_email / following_email are
-- the relationship. We let a user read rows where they are either side (so they
-- can compute followers/following), and write only rows they created.
-- FLAG: follower/following counts shown publicly would need a broader read or an
-- rpc count. Left scoped-to-involved pending decision.
CREATE POLICY "follows_involved_select" ON public.follows
  FOR SELECT TO authenticated
  USING (
    created_by = public.current_clerk_id()
    OR follower_email  = public.current_clerk_email()
    OR following_email = public.current_clerk_email()
  );
CREATE POLICY "follows_owner_insert" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "follows_owner_delete" ON public.follows
  FOR DELETE TO authenticated
  USING (created_by = public.current_clerk_id());
-- (No UPDATE policy: follow rows are insert/delete only.)

-- ============================================================================
-- 7. NOTIFICATIONS  (recipient-only; keyed on EMAIL — see flag)
-- ============================================================================
-- ownerField = user_email. The app stores the recipient EMAIL, not a Clerk id.
-- So this policy keys on auth.jwt()->>'email'. This requires the Clerk 'supabase'
-- JWT template to include an `email` claim (Clerk's default template does NOT —
-- it must be added: {"email": "{{user.primary_email_address}}"}).
-- *** ELAD MUST CONFIRM the JWT template emits `email` *** — see DECISIONS NEEDED.
CREATE POLICY "notifications_recipient_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (lower(user_email) = public.current_clerk_email());
-- Recipient may mark-as-read (UPDATE) their own notifications.
CREATE POLICY "notifications_recipient_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (lower(user_email) = public.current_clerk_email())
  WITH CHECK (lower(user_email) = public.current_clerk_email());
-- INSERT: notifications are created FOR other users (e.g. "X followed you"),
-- so the creator's email != recipient's email. Client-side insert under RLS
-- cannot satisfy a recipient-only CHECK. FLAG: notification creation should move
-- to a SECURITY DEFINER rpc / server route. Pending that, the INSERT below allows
-- an authenticated user to create a notification ONLY when they are the creator
-- (created_by = their id) — adjust once server-side creation lands.
CREATE POLICY "notifications_author_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY "notifications_recipient_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (lower(user_email) = public.current_clerk_email());

-- ============================================================================
-- 8. USER_BADGES  (owner write; authenticated read for leaderboard)
-- ============================================================================
-- ownerField = user_id. Leaderboard.jsx reads badges across users. We allow any
-- authenticated user to SELECT badges (non-PII: badge_id, progress), but only
-- the owner may write their own. FLAG: if leaderboard must work for anon, change
-- the SELECT role to include `anon`. Default: authenticated-only read.
CREATE POLICY "user_badges_authed_select" ON public.user_badges
  FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "user_badges_owner_insert" ON public.user_badges
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_clerk_id());
CREATE POLICY "user_badges_owner_update" ON public.user_badges
  FOR UPDATE TO authenticated
  USING (user_id = public.current_clerk_id())
  WITH CHECK (user_id = public.current_clerk_id());
CREATE POLICY "user_badges_owner_delete" ON public.user_badges
  FOR DELETE TO authenticated
  USING (user_id = public.current_clerk_id());

COMMIT;

-- ============================================================================
-- DATA BACKFILL (DO NOT RUN BLIND — see APPLY-INSTRUCTIONS.md step 2)
-- ============================================================================
-- Existing rows have created_by = EMAIL (because secureEntity.js wrote
-- user.email). After you fix the code to write user.id, NEW rows will have a
-- Clerk id while OLD rows still have an email — and the policies above key on the
-- Clerk id, so users will be locked out of their old data.
--
-- You need a mapping email -> clerk_id. The DB does NOT contain it (Clerk is the
-- source of truth). Options, in order of preference:
--
--   OPTION A (preferred, no data loss): export the Clerk user list
--   (id + primary email) and build an UPDATE per user, e.g.:
--
--       -- For each user, fill in the real values from the Clerk export:
--       UPDATE public.books        SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.pages        SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.characters   SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.story_ideas  SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.feedback     SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.community    SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.comments     SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.collaborations SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       UPDATE public.follows      SET created_by = 'user_REALCLERKID'
--         WHERE created_by = 'parent@example.com';
--       -- user_badges.user_id and notifications.user_email may already hold the
--       -- right value depending on how the app wrote them — VERIFY before touching.
--
--   *** Claude did NOT guess any email->id values. You must supply them from the
--       Clerk dashboard export (Users -> export, or Clerk Backend API
--       GET /v1/users). ***
--
--   OPTION B (only if there is little/no real prod data): TRUNCATE the affected
--   tables and start clean. Confirm with a count first:
--       SELECT 'books' t, count(*) FROM books
--       UNION ALL SELECT 'pages', count(*) FROM pages
--       UNION ALL SELECT 'characters', count(*) FROM characters
--       UNION ALL SELECT 'community', count(*) FROM community;  -- etc.
--
-- After backfill + code fix, NEW + OLD rows both key on the Clerk id and policies
-- work uniformly.
-- ============================================================================
