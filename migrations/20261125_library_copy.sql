BEGIN;

CREATE FUNCTION public.sipurai_finalize_library_copy(
    p_source uuid,
    p_target uuid,
    p_source_page_ids uuid[]
)
RETURNS TABLE (copied_count integer, inserted_count integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    caller text := public.current_clerk_id();
    target public.books%ROWTYPE;
    source_pages public.pages[];
    existing public.pages%ROWTYPE;
    expected public.pages%ROWTYPE;
    keep_numbers integer[] := ARRAY[]::integer[];
    plan_count integer;
    trim_chars constant text := chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || ' '
      || U&'\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
BEGIN
    IF caller IS NULL OR p_source IS NULL OR p_target IS NULL OR p_source = p_target THEN
        RAISE EXCEPTION 'library_copy_conflict';
    END IF;

    -- Take the same row lock as an ordinary book update. Check privacy on the
    -- locked row, including any update that committed while we were waiting.
    PERFORM 1 FROM public.books
      WHERE id IN (p_source, p_target) AND created_by = caller
      ORDER BY id FOR UPDATE;
    IF NOT EXISTS (SELECT 1 FROM public.books WHERE id = p_source AND created_by = caller) THEN
        RAISE EXCEPTION 'library_copy_conflict';
    END IF;
    SELECT * INTO target FROM public.books WHERE id = p_target AND created_by = caller;
    IF NOT FOUND OR target.is_public IS DISTINCT FROM false
       OR target.status IS NULL OR target.status NOT IN ('draft', 'complete') THEN
        RAISE EXCEPTION 'library_copy_conflict';
    END IF;

    SELECT array_agg(locked.page ORDER BY (locked.page).page_number, (locked.page).id)
      INTO source_pages
      FROM (
        SELECT p AS page FROM public.pages p
        WHERE p.book_id = p_source AND p.created_by = caller
          AND btrim(p.text_content, trim_chars) <> ''
        ORDER BY p.page_number, p.id FOR SHARE
      ) AS locked;
    plan_count := coalesce(cardinality(source_pages), 0);
    IF plan_count = 0 OR target.total_pages IS DISTINCT FROM plan_count
       OR ARRAY(SELECT p.id FROM unnest(source_pages) AS p ORDER BY p.page_number, p.id)
          IS DISTINCT FROM p_source_page_ids THEN
        RAISE EXCEPTION 'library_copy_conflict';
    END IF;

    FOR existing IN
        SELECT p.* FROM public.pages p
         WHERE p.book_id = p_target AND p.created_by = caller
         ORDER BY p.page_number, p.id FOR UPDATE
    LOOP
        IF existing.page_number IS NULL OR existing.page_number < 0
           OR existing.page_number >= plan_count OR existing.page_number = ANY(keep_numbers) THEN
            RAISE EXCEPTION 'library_copy_conflict';
        END IF;

        expected := source_pages[existing.page_number + 1];
        IF ROW(existing.text_content, existing.image_url, existing.image_prompt, existing.layout_type)
           IS DISTINCT FROM ROW(expected.text_content, expected.image_url, expected.image_prompt, expected.layout_type) THEN
            RAISE EXCEPTION 'library_copy_conflict';
        END IF;
        keep_numbers := array_append(keep_numbers, existing.page_number);
    END LOOP;

    copied_count := plan_count;
    inserted_count := 0;
    IF target.status = 'complete' THEN
        IF cardinality(keep_numbers) <> plan_count THEN RAISE EXCEPTION 'library_copy_conflict'; END IF;
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.pages (book_id, created_by, page_number, text_content, image_url, image_prompt, layout_type)
    SELECT p_target, caller, position - 1,
           (source_pages[position]).text_content, (source_pages[position]).image_url,
           (source_pages[position]).image_prompt, (source_pages[position]).layout_type
      FROM generate_subscripts(source_pages, 1) AS positions(position)
     WHERE NOT ((position - 1) = ANY(keep_numbers))
     ORDER BY position;
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count + cardinality(keep_numbers) <> plan_count THEN
        RAISE EXCEPTION 'library_copy_conflict';
    END IF;

    UPDATE public.books SET status = 'complete', total_pages = plan_count
     WHERE id = p_target AND created_by = caller AND is_public = false AND status = 'draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'library_copy_conflict'; END IF;
    RETURN NEXT;
END
$$;

REVOKE ALL ON FUNCTION public.sipurai_finalize_library_copy(uuid, uuid, uuid[]) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.sipurai_finalize_library_copy(uuid, uuid, uuid[]) TO authenticated;

COMMIT;
