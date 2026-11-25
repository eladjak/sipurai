-- The bootstrap supplies the real table shape. Model the deployed Clerk JWT
-- subject and the book/page owner policies without external credentials.
CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb
$$;
CREATE FUNCTION public.current_clerk_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(auth.jwt() ->> 'sub', '')
$$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT ON public.books, public.pages TO authenticated;
GRANT UPDATE ON public.pages TO authenticated;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_owner_select ON public.books FOR SELECT TO authenticated USING (created_by = public.current_clerk_id());
CREATE POLICY pages_owner_select ON public.pages FOR SELECT TO authenticated USING (created_by = public.current_clerk_id());
CREATE POLICY pages_owner_update ON public.pages FOR UPDATE TO authenticated
  USING (created_by = public.current_clerk_id()) WITH CHECK (created_by = public.current_clerk_id());

INSERT INTO public.books (id, created_by) VALUES ('22222222-2222-4222-8222-222222222222', 'other-owner');
INSERT INTO public.pages (id, book_id, created_by, page_number, text_content) VALUES
  ('11111111-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','owner',0,NULL),
  ('11111111-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','owner',0,''),
  ('11111111-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','other-owner',1,''),
  ('11111111-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','owner',2,'base');

\ir ../../migrations/20261125_editor_page_text.sql

DO $$
DECLARE fn regprocedure := 'public.sipurai_save_page_text(uuid,uuid,text,text,text)'::regprocedure;
BEGIN
  IF NOT has_function_privilege('authenticated', fn, 'EXECUTE')
    OR has_function_privilege('anon', fn, 'EXECUTE')
    OR has_function_privilege('service_role', fn, 'EXECUTE')
    OR (SELECT prosecdef FROM pg_catalog.pg_proc WHERE oid = fn)
  THEN RAISE EXCEPTION 'unexpected editor RPC privileges'; END IF;
END
$$;

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"owner"}';
DO $$
DECLARE
  book uuid := '11111111-1111-4111-8111-111111111111';
  page uuid := '11111111-0000-4000-8000-000000000001';
  long_text text := repeat(U&'\05D0', 16000);
BEGIN
  IF EXISTS (SELECT FROM public.sipurai_save_page_text(page,book,'owner','','try'))
    OR EXISTS (SELECT FROM public.sipurai_save_page_text(page,book,'other-owner',NULL,'try'))
    OR EXISTS (SELECT FROM public.sipurai_save_page_text('11111111-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','owner','','try'))
    OR EXISTS (SELECT FROM public.sipurai_save_page_text('11111111-0000-4000-8000-000000000003',book,'owner','','try'))
  THEN RAISE EXCEPTION 'foreign or stale row accepted'; END IF;

  IF (SELECT text_content FROM public.sipurai_save_page_text(page,book,'owner',NULL,'')) IS DISTINCT FROM ''
    OR EXISTS (SELECT FROM public.sipurai_save_page_text(page,book,'owner',NULL,'try'))
  THEN RAISE EXCEPTION 'SQL NULL and empty text were not distinguished'; END IF;

  IF (SELECT text_content FROM public.sipurai_save_page_text(page,book,'owner','',long_text)) IS DISTINCT FROM long_text THEN
    RAISE EXCEPTION 'long Hebrew write failed';
  END IF;
  IF (SELECT text_content FROM public.sipurai_save_page_text(page,book,'owner',long_text,'shortened')) IS DISTINCT FROM 'shortened' THEN
    RAISE EXCEPTION 'long Hebrew compare failed';
  END IF;
END
$$;
RESET ROLE;
