SET ROLE authenticated;
SET request.jwt.claims = '{"sub":"owner"}';
DO $$
DECLARE
  source uuid := '10000000-0000-4000-8000-000000000000';
  copy uuid := '20000000-0000-4000-8000-000000000000';
  altered uuid := '40000000-0000-4000-8000-000000000000';
  other uuid := '50000000-0000-4000-8000-000000000000';
  ids uuid[] := ARRAY['11000000-0000-4000-8000-000000000000', '12000000-0000-4000-8000-000000000000']::uuid[];
  result record;
  destination uuid;
BEGIN
  IF has_function_privilege('anon', 'public.sipurai_finalize_library_copy(uuid,uuid,uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon has execute';
  END IF;
  FOREACH destination IN ARRAY ARRAY[altered, other, source] LOOP
    BEGIN
      PERFORM public.sipurai_finalize_library_copy(source, destination, ids);
      RAISE EXCEPTION 'invalid destination unexpectedly accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'library_copy_conflict' THEN RAISE; END IF;
    END;
  END LOOP;
  SELECT * INTO result FROM public.sipurai_finalize_library_copy(source, copy, ids);
  IF result.copied_count <> 2 OR result.inserted_count <> 1 THEN RAISE EXCEPTION 'incorrect initial count'; END IF;
  SELECT * INTO result FROM public.sipurai_finalize_library_copy(source, copy, ids);
  IF result.copied_count <> 2 OR result.inserted_count <> 0 THEN RAISE EXCEPTION 'not idempotent'; END IF;
  IF (SELECT array_agg(page_number ORDER BY page_number) FROM public.pages WHERE book_id = copy) <> ARRAY[0,1]
     OR (SELECT array_agg(page_number ORDER BY page_number) FROM public.pages WHERE book_id = source) <> ARRAY[4,9,10]
     OR NOT EXISTS (SELECT 1 FROM public.pages WHERE id = '21000000-0000-4000-8000-000000000000' AND book_id = copy)
     OR NOT EXISTS (SELECT 1 FROM public.books WHERE id = copy AND status = 'complete' AND is_public = false) THEN
      RAISE EXCEPTION 'wrong copy or source state';
  END IF;
END $$;
RESET ROLE;
