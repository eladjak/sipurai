-- ============================================================================
-- Sipurai - privacy fix 12.11.2026 (DB worker)
--   1. profiles: a signed-in parent may read ONLY their own row. Today
--      "profiles_authed_select" USING (true) lets any parent read every other
--      parent's email and display name.
--   2. The two features that needed other users' rows now use SECURITY DEFINER
--      RPCs that return the minimum:
--        resolve_clerk_id(email)  -> clerk id only (no email, no name)
--        notify_my_followers(...) -> inserts notifications for the CALLER's
--                                    followers server-side; the browser never
--                                    sees follower emails or ids.
--   3. public.public_pages no longer exposes image_prompt (the prompt sent to
--      the image model: child's name and looks) or created_by (author id).
--      Only the columns the public reader reads are kept.
-- Rollback: 2026-11-12-profiles-and-public-pages.rollback.sql
-- Apply by the orchestrator only. Not run against any database by the worker.
-- ============================================================================

BEGIN;

-- ---- 1. profiles: self-only select ----------------------------------------
DROP POLICY IF EXISTS "profiles_authed_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (clerk_id = (SELECT public.current_clerk_id()));

-- ---- 2a. email -> clerk id (clerk id only) ---------------------------------
CREATE OR REPLACE FUNCTION public.resolve_clerk_id(target_email citext)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller text := (SELECT public.current_clerk_id());
  v_id     text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT clerk_id INTO v_id
    FROM public.profiles
   WHERE email = lower(trim(target_email))
   LIMIT 1;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_clerk_id(citext) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.resolve_clerk_id(citext) TO authenticated;

-- ---- 2b. notify the caller's followers, server-side ------------------------
CREATE OR REPLACE FUNCTION public.notify_my_followers(
  p_type    text,
  p_title   text,
  p_message text,
  p_link    text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller text := (SELECT public.current_clerk_id());
  v_count  integer;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.notifications
    (created_by, actor_id, recipient_id, type, title, message, link, read, created_date)
  SELECT v_caller, v_caller, f.follower_id, p_type, coalesce(p_title,''),
         coalesce(p_message,''), coalesce(p_link,''), false, now()
    FROM public.follows f
   WHERE f.following_id = v_caller
     AND f.follower_id IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_my_followers(text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_my_followers(text, text, text, text) TO authenticated;

-- ---- 3. public_pages: only what the public reader needs --------------------
-- Dropped columns: image_prompt, created_by. (Column removal needs DROP+CREATE.)
DROP VIEW IF EXISTS public.public_pages;
CREATE VIEW public.public_pages
WITH (security_invoker = off) AS
  SELECT
    p.id,
    p.book_id,
    p.page_number,
    p.text_content,
    p.image_url,
    p.layout_type,
    p.created_date
  FROM public.pages p
  WHERE EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = p.book_id AND b.is_public = true
  );

-- Same grants as 2026-05-25-public-pii-safe-views.sql: read-only for anon + authenticated.
REVOKE ALL ON public.public_pages FROM anon, authenticated;
GRANT SELECT ON public.public_pages TO anon, authenticated;

-- public_books (reviewed, unchanged): id, title, description, moral, art_style,
-- genre, age_range, language, tone, status, cover_image, total_pages,
-- created_date, is_public. No child name/age/gender/family, no author id.

COMMIT;
