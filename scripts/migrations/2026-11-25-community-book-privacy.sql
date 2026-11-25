-- Additive guards: existing permissive policies remain the source of grants.
-- public_books is the live, sanitized definer view; books has owner-only RLS.
BEGIN;
CREATE POLICY community_live_public_book_guard ON public.community
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    created_by = public.current_clerk_id()
    OR book_id IS NULL
    OR EXISTS (SELECT 1 FROM public.public_books b WHERE b.id = community.book_id)
  );

CREATE POLICY comments_live_public_book_guard ON public.comments
  AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    created_by = public.current_clerk_id()
    OR EXISTS (
      SELECT 1 FROM public.community c
      WHERE c.id = comments.community_id
        AND c.visibility = 'public'
        AND (c.book_id IS NULL OR EXISTS (
          SELECT 1 FROM public.public_books b WHERE b.id = c.book_id
        ))
    )
  );
COMMIT;
