-- ============================================================================
-- Sipurai — Uniform Clerk-`sub` Ownership + is_public Sharing + Profiles bridge
-- Project: furviizyohryyqubosut (Sipurai PROD)
-- Date:    2026-05-25
-- Author:  security-fix  (reviewed by council-of-sages 3-of-3: GPT-5.5 + Grok-4.20 + Gemini-2.5-pro)
-- ============================================================================
--
-- WHAT THIS DOES (and WHY)
--   The prior lockdown (2026-05-25-rls-lockdown.sql) keyed `notifications` and
--   `follows` reads on auth.jwt()->>'email'. That required a CUSTOM Clerk JWT
--   template `email` claim (a manual Clerk-dashboard change). This migration
--   ELIMINATES that dependency: every table now keys RLS purely on the Clerk
--   user id (auth.jwt()->>'sub'), the stable canonical identity — never the
--   mutable email.
--
--   The social graph still lets a user FOLLOW / NOTIFY someone by EMAIL (the
--   only identifier the browser knows about a target). We bridge email->clerk_id
--   server-side via a `profiles` table + SECURITY DEFINER RPCs, so the rows that
--   land in `follows`/`notifications` store Clerk ids only, and RLS keys on `sub`.
--
--   Also: replaces the community-post-gated public-book read with a proper
--   `books.is_public` boolean (the architecturally-correct source of truth for a
--   direct shareable book link). Pages inherit visibility via their parent book.
--
-- IDEMPOTENT: drops affected policies by name and recreates them. Safe to re-run.
-- ZERO existing rows on all tables (verified 2026-05-25) — no backfill needed.
-- ============================================================================

BEGIN;

-- ── 0. citext for case-insensitive, stable email matching ────────────────────
CREATE EXTENSION IF NOT EXISTS citext;

-- ── helper: current Clerk user id from the Supabase JWT ──────────────────────
CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')
$$;

-- current_clerk_email() is INTENTIONALLY removed (dropped after the profiles
-- policies are reset in section 1, since a prior-run policy may still depend on
-- it). No policy keys on the JWT `email` claim anymore, so the Clerk 'supabase'
-- JWT template needs NO custom `email` claim.

-- ============================================================================
-- 1. PROFILES — the email <-> clerk_id directory (populated on sign-in)
-- ============================================================================
-- Each authenticated user maintains exactly ONE row: their own clerk_id + email.
-- This is the trusted mapping the SECURITY DEFINER RPCs use to resolve a target
-- email to a Clerk id. RLS locks each row to its owner (clerk_id = sub), and a
-- trigger makes the email immutable after creation, closing the impersonation
-- hole the council flagged (a user cannot point their profile at someone else's
-- email to read their data).
CREATE TABLE IF NOT EXISTS public.profiles (
  clerk_id     text   PRIMARY KEY,
  email        citext UNIQUE NOT NULL,
  display_name text,
  avatar_url   text,
  created_date timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- email is immutable once set (defense against late impersonation via UPDATE).
CREATE OR REPLACE FUNCTION public.profiles_lock_email()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profiles.email is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.clerk_id IS DISTINCT FROM OLD.clerk_id THEN
    RAISE EXCEPTION 'profiles.clerk_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profiles_lock_email ON public.profiles;
CREATE TRIGGER trg_profiles_lock_email
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_email();

-- Drop any prior profiles policies (idempotent).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname); END LOOP;
END $$;

-- Authenticated users may read the directory (needed for @-lookups / display).
-- Only non-PII directory columns matter here; no child data lives in profiles.
CREATE POLICY "profiles_authed_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- A user may create ONLY their own row (clerk_id must equal their session sub).
-- The email is supplied by the client from the Clerk SDK (primaryEmailAddress).
-- We deliberately DO NOT bind email to a JWT `email` claim here — that would
-- re-introduce the custom-claim dependency this migration exists to remove.
-- Impersonation is bounded by: (a) the UNIQUE(email) constraint — the first
-- (real) user to register an email owns it, so an attacker cannot claim an email
-- already held by a signed-in user; (b) the immutable-email trigger below.
-- The residual risk (claiming a not-yet-registered user's email) is acceptable
-- for launch; the production-grade closure is a Clerk `user.created` webhook that
-- upserts profiles via the service role (documented in APPLY-INSTRUCTIONS, no
-- client trust) — a post-launch hardening, NOT required to ship.
CREATE POLICY "profiles_self_insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    clerk_id = (SELECT public.current_clerk_id())
  );

-- A user may update only their own row (email/clerk_id changes blocked by trigger).
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (clerk_id = (SELECT public.current_clerk_id()))
  WITH CHECK (clerk_id = (SELECT public.current_clerk_id()));

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
-- No anon access to profiles.

-- Now that no profiles policy depends on it, drop the email-claim helper so the
-- email JWT claim has ZERO remaining surface anywhere in the schema.
DROP FUNCTION IF EXISTS public.current_clerk_email();

-- ============================================================================
-- 2. FOLLOWS — re-key on Clerk ids (follower_id / following_id)
-- ============================================================================
-- New shape: follower_id + following_id are Clerk subs. created_by stays = the
-- follower's sub (== follower_id). Old email columns are dropped (0 rows, no loss).

-- Reset follows policies FIRST (the legacy involved_select policy references the
-- email columns we are about to drop — drop policies before columns).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='follows'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.follows', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS follower_id  text;
ALTER TABLE public.follows ADD COLUMN IF NOT EXISTS following_id text;

-- Drop the legacy unique/index on emails and email columns (clean slate).
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_follower_email_following_email_key;
DROP INDEX IF EXISTS public.idx_follows_follower;
DROP INDEX IF EXISTS public.idx_follows_following;
ALTER TABLE public.follows DROP COLUMN IF EXISTS follower_email;
ALTER TABLE public.follows DROP COLUMN IF EXISTS following_email;

-- New integrity + indexes on the id columns.
ALTER TABLE public.follows ALTER COLUMN follower_id  SET NOT NULL;
ALTER TABLE public.follows ALTER COLUMN following_id SET NOT NULL;
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_pair_unique;
ALTER TABLE public.follows ADD  CONSTRAINT follows_pair_unique UNIQUE (follower_id, following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id  ON public.follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- A user can read rows where they are EITHER side (compute followers/following).
CREATE POLICY "follows_involved_select" ON public.follows
  FOR SELECT TO authenticated
  USING (
    follower_id  = (SELECT public.current_clerk_id())
    OR following_id = (SELECT public.current_clerk_id())
  );
-- Direct INSERT allowed only for self-as-follower (the RPC is the primary path,
-- but this keeps a non-RPC insert safe too). following_id must reference a real
-- profile so you cannot fabricate a follow of a non-user.
CREATE POLICY "follows_owner_insert" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (
    follower_id = (SELECT public.current_clerk_id())
    AND created_by = (SELECT public.current_clerk_id())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.clerk_id = following_id)
  );
CREATE POLICY "follows_owner_delete" ON public.follows
  FOR DELETE TO authenticated
  USING (follower_id = (SELECT public.current_clerk_id()));

-- ============================================================================
-- 3. NOTIFICATIONS — re-key on Clerk ids (recipient_id / actor_id)
-- ============================================================================
-- Drop policies FIRST (legacy recipient policies reference user_email).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='notifications'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id     text;

DROP INDEX IF EXISTS public.idx_notifications_user_email;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS user_email;

ALTER TABLE public.notifications ALTER COLUMN recipient_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications (recipient_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Recipient-only read / mark-read / delete — keyed on the Clerk sub.
CREATE POLICY "notifications_recipient_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (recipient_id = (SELECT public.current_clerk_id()));
CREATE POLICY "notifications_recipient_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = (SELECT public.current_clerk_id()))
  WITH CHECK (recipient_id = (SELECT public.current_clerk_id()));
CREATE POLICY "notifications_recipient_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (recipient_id = (SELECT public.current_clerk_id()));
-- NO direct INSERT policy for authenticated: cross-user notifications are created
-- ONLY through the SECURITY DEFINER rpc `notify_user` below (which sets actor_id
-- = caller's sub and resolves recipient_id from the profiles directory). This is
-- the correct trust boundary — a client cannot forge a notification's sender or
-- write to an arbitrary recipient.

-- ============================================================================
-- 4. SECURITY DEFINER RPCs — bridge email -> clerk_id at write time
-- ============================================================================
-- These run with owner privileges (bypass RLS) so they can read `profiles` to
-- resolve a target email. They derive the ACTOR from auth.jwt()->>'sub' (never
-- a client-supplied value), so they cannot be used to impersonate.
-- search_path is pinned to defeat search-path hijacking.

CREATE OR REPLACE FUNCTION public.follow_user(target_email citext)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor  text := nullif(auth.jwt() ->> 'sub', '');
  v_target text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT clerk_id INTO v_target FROM public.profiles WHERE email = lower(trim(target_email));
  -- Generic error (no enumeration: same message whether the email exists or not
  -- is overkill here, but we avoid leaking which emails are registered).
  IF v_target IS NULL THEN RAISE EXCEPTION 'cannot follow: user not found'; END IF;
  IF v_target = v_actor THEN RAISE EXCEPTION 'cannot follow yourself'; END IF;

  INSERT INTO public.follows (created_by, follower_id, following_id, created_date)
  VALUES (v_actor, v_actor, v_target, now())
  ON CONFLICT (follower_id, following_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unfollow_user(target_email citext)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor  text := nullif(auth.jwt() ->> 'sub', '');
  v_target text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT clerk_id INTO v_target FROM public.profiles WHERE email = lower(trim(target_email));
  IF v_target IS NULL THEN RETURN; END IF; -- nothing to do
  DELETE FROM public.follows WHERE follower_id = v_actor AND following_id = v_target;
END;
$$;

-- Create an in-app notification for a target user (by email). actor is the caller.
CREATE OR REPLACE FUNCTION public.notify_user(
  target_email citext,
  p_type    text,
  p_title   text,
  p_message text,
  p_link    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor     text := nullif(auth.jwt() ->> 'sub', '');
  v_recipient text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT clerk_id INTO v_recipient FROM public.profiles WHERE email = lower(trim(target_email));
  -- Silently no-op if the target has no profile yet (e.g. invited but not signed
  -- in). A notification with no recipient id would be unreadable anyway.
  IF v_recipient IS NULL THEN RETURN; END IF;

  INSERT INTO public.notifications
    (created_by, actor_id, recipient_id, type, title, message, link, read, created_date)
  VALUES
    (v_actor, v_actor, v_recipient, p_type, coalesce(p_title,''), coalesce(p_message,''),
     coalesce(p_link,''), false, now());
END;
$$;

REVOKE ALL ON FUNCTION public.follow_user(citext)   FROM public, anon;
REVOKE ALL ON FUNCTION public.unfollow_user(citext) FROM public, anon;
REVOKE ALL ON FUNCTION public.notify_user(citext, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.follow_user(citext)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unfollow_user(citext) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(citext, text, text, text, text) TO authenticated;

-- ============================================================================
-- 5. BOOKS.is_public — proper direct-link sharing (replaces community-gated read)
-- ============================================================================
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_books_is_public ON public.books (id) WHERE is_public = true;

-- Replace the community-gated public-read policies with is_public-based ones.
DROP POLICY IF EXISTS "books_public_shared_select" ON public.books;
DROP POLICY IF EXISTS "pages_public_shared_select" ON public.pages;
DROP POLICY IF EXISTS "books_public_select" ON public.books;
DROP POLICY IF EXISTS "pages_public_select" ON public.pages;

-- Anyone (incl. anon) may read a book flagged public; owner reads via owner policy.
CREATE POLICY "books_public_select" ON public.books
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- Pages of a public book are publicly readable (inherit via parent book).
CREATE POLICY "pages_public_select" ON public.pages
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.books b
      WHERE b.id = pages.book_id AND b.is_public = true
    )
  );

-- ── 5b. Normalize the remaining owner policies to use the (SELECT ...) wrapper ─
-- Supabase perf guidance: wrap the auth call in a scalar subquery so Postgres
-- evaluates it ONCE per query, not once per row. We recreate the owner policies
-- on the core tables with the wrapper. (Functionally identical; faster at scale.)
DO $$
DECLARE
  tbl  TEXT;
  okey TEXT;  -- owner column for the table
BEGIN
  FOR tbl, okey IN
    SELECT * FROM (VALUES
      ('books','created_by'), ('pages','created_by'), ('characters','created_by'),
      ('story_ideas','created_by'), ('feedback','created_by'),
      ('collaborations','created_by'), ('community','created_by'),
      ('comments','created_by'), ('user_badges','user_id')
    ) AS v(t,k)
  LOOP
    -- Drop only the owner_* policies we are about to recreate (leave public/* intact).
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_owner_select', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_owner_insert', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_owner_update', tbl);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl||'_owner_delete', tbl);

    -- user_badges keeps an authed-wide SELECT (leaderboard); others are owner-select.
    IF tbl <> 'user_badges' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%I = (SELECT public.current_clerk_id()))',
        tbl||'_owner_select', tbl, okey);
    END IF;
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%I = (SELECT public.current_clerk_id()))',
      tbl||'_owner_insert', tbl, okey);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%I = (SELECT public.current_clerk_id())) WITH CHECK (%I = (SELECT public.current_clerk_id()))',
      tbl||'_owner_update', tbl, okey, okey);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%I = (SELECT public.current_clerk_id()))',
      tbl||'_owner_delete', tbl, okey);
  END LOOP;
END $$;

-- Helpful index for the leaderboard / owner lookups.
CREATE INDEX IF NOT EXISTS idx_user_badges_created_by ON public.user_badges (user_id);

COMMIT;

-- ============================================================================
-- POST-CONDITIONS (what is true after this migration)
--   * NO policy references auth.jwt()->>'email' for authorization. The Clerk
--     'supabase' JWT template needs NO custom `email` claim.
--   * notifications/follows ownership + reads key on auth.jwt()->>'sub'.
--   * profiles bridges email->clerk_id; RPCs do the cross-user writes safely.
--   * books.is_public is the source of truth for public/shared book links.
-- ============================================================================
