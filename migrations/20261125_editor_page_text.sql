BEGIN;

-- Deploy before the editor client that calls this RPC. Existing clients can continue editing.
CREATE FUNCTION public.sipurai_save_page_text (
    p_page_id uuid,
    p_book_id uuid,
    p_owner_id text,
    p_expected_text text,
    p_text text
)
RETURNS TABLE (id uuid, text_content text)
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
    UPDATE public.pages AS page
    SET text_content = p_text
    WHERE page.id = p_page_id
        AND page.book_id = p_book_id
        AND page.created_by = p_owner_id
        AND p_owner_id = public.current_clerk_id()
        AND p_text IS NOT NULL
        AND page.text_content IS NOT DISTINCT FROM p_expected_text
        AND EXISTS (
            SELECT 1
            FROM public.books AS book
            WHERE book.id = p_book_id AND book.created_by = p_owner_id
        )
    RETURNING page.id, page.text_content
$$;

REVOKE ALL ON FUNCTION public.sipurai_save_page_text(uuid, uuid, text, text, text)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sipurai_save_page_text(uuid, uuid, text, text, text)
    TO authenticated;

COMMIT;
