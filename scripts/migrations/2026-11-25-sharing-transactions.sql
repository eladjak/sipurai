-- Apply after Clerk ownership and sharing-privacy RLS migrations, before the clients.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sipurai_private;
REVOKE ALL ON SCHEMA sipurai_private FROM PUBLIC;
GRANT USAGE ON SCHEMA sipurai_private TO authenticated;

-- Existing mismatched listings can be invisible to the book owner under RLS.
-- Return only a cleanup flag for an exact book owned by the caller.
CREATE OR REPLACE FUNCTION sipurai_private.book_has_listings(p_book uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.books b
    JOIN public.community c ON c.book_id = b.id
    WHERE b.id = p_book AND b.created_by = public.current_clerk_id()
  );
$$;
REVOKE ALL ON FUNCTION sipurai_private.book_has_listings(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sipurai_private.book_has_listings(uuid) TO authenticated;

CREATE POLICY community_owned_book_insert ON public.community
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (book_id IS NULL OR EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = community.book_id AND b.created_by = (SELECT public.current_clerk_id())
  ));
CREATE POLICY community_owned_book_update ON public.community
  AS RESTRICTIVE FOR UPDATE TO authenticated
  WITH CHECK (book_id IS NULL OR EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = community.book_id AND b.created_by = (SELECT public.current_clerk_id())
  ));

CREATE OR REPLACE FUNCTION public.sipurai_publish_book(p_book uuid, p_expected_public boolean, p_listing jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  caller text := public.current_clerk_id();
  actual boolean;
  listing_id uuid;
  listing_created boolean := false;
BEGIN
  SELECT b.is_public INTO actual FROM public.books b
    WHERE b.id = p_book AND b.created_by = caller FOR UPDATE;
  IF NOT FOUND OR caller IS NULL THEN RAISE EXCEPTION 'sipurai_not_found'; END IF;
  IF actual IS DISTINCT FROM p_expected_public THEN RAISE EXCEPTION 'sipurai_stale_visibility'; END IF;
  IF NOT actual AND sipurai_private.book_has_listings(p_book) THEN
    RAISE EXCEPTION 'sipurai_cleanup_required';
  END IF;
  IF p_listing IS NOT NULL THEN
    IF jsonb_typeof(p_listing) IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_listing->'title') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_listing->'description') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_listing->'tags') IS DISTINCT FROM 'array'
      OR btrim(p_listing->>'title') = ''
      OR btrim(p_listing->>'description') = '' THEN
      RAISE EXCEPTION 'sipurai_invalid_listing';
    END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_listing->'tags') tag WHERE jsonb_typeof(tag) <> 'string') THEN
      RAISE EXCEPTION 'sipurai_invalid_listing';
    END IF;
    SELECT c.id INTO listing_id FROM public.community c
      WHERE c.book_id = p_book AND c.created_by = caller AND c.visibility = 'public'
      ORDER BY c.created_date, c.id LIMIT 1;
    IF listing_id IS NULL THEN
      INSERT INTO public.community (created_by, user_id, book_id, visibility, title, description, tags)
        VALUES (caller, caller, p_book, 'public', p_listing->>'title', p_listing->>'description', p_listing->'tags');
      listing_created := true;
    ELSE
      UPDATE public.community SET user_id = caller, title = p_listing->>'title', description = p_listing->>'description', tags = p_listing->'tags'
        WHERE id = listing_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'sipurai_listing_failed'; END IF;
    END IF;
  END IF;
  UPDATE public.books SET is_public = true WHERE id = p_book AND created_by = caller;
  IF NOT FOUND THEN RAISE EXCEPTION 'sipurai_publish_failed'; END IF;
  RETURN jsonb_build_object('is_public', true, 'listing_created', listing_created);
END $$;

CREATE OR REPLACE FUNCTION public.sipurai_unshare_book(p_book uuid, p_user text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE removed integer;
BEGIN
  PERFORM 1 FROM public.books b WHERE b.id = p_book AND b.created_by = p_user FOR UPDATE;
  IF NOT FOUND OR p_user IS NULL OR p_user = '' THEN RAISE EXCEPTION 'sipurai_not_found'; END IF;
  UPDATE public.books SET is_public = false WHERE id = p_book AND created_by = p_user;
  DELETE FROM public.comments WHERE community_id IN (SELECT id FROM public.community WHERE book_id = p_book);
  DELETE FROM public.community WHERE book_id = p_book;
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END $$;
REVOKE ALL ON FUNCTION public.sipurai_publish_book(uuid, boolean, jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sipurai_publish_book(uuid, boolean, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.sipurai_unshare_book(uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sipurai_unshare_book(uuid, text) TO service_role;
COMMIT;
