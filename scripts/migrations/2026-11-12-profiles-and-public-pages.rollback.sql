-- Rollback for 2026-11-12-profiles-and-public-pages.sql
-- Restores the state measured live on 12.11.2026.
BEGIN;

DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
CREATE POLICY "profiles_authed_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP FUNCTION IF EXISTS public.resolve_clerk_id(citext);
DROP FUNCTION IF EXISTS public.notify_my_followers(text, text, text, text);

DROP VIEW IF EXISTS public.public_pages;
CREATE VIEW public.public_pages
WITH (security_invoker = off) AS
  SELECT p.id, p.created_by, p.book_id, p.page_number, p.text_content,
         p.image_url, p.image_prompt, p.layout_type, p.created_date
  FROM public.pages p
  WHERE EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = p.book_id AND b.is_public = true
  );
REVOKE ALL ON public.public_pages FROM anon, authenticated;
GRANT SELECT ON public.public_pages TO anon, authenticated;

COMMIT;
