CREATE SCHEMA auth;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
CREATE FUNCTION public.current_clerk_id() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT nullif(auth.jwt() ->> 'sub', '') $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.books, public.pages TO authenticated;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_owner_read ON public.books FOR SELECT TO authenticated
    USING (created_by = public.current_clerk_id() OR is_public);
CREATE POLICY books_owner_write ON public.books FOR UPDATE TO authenticated
    USING (created_by = public.current_clerk_id()) WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY pages_owner_read ON public.pages FOR SELECT TO authenticated
    USING (created_by = public.current_clerk_id());
CREATE POLICY pages_owner_write ON public.pages FOR UPDATE TO authenticated
    USING (created_by = public.current_clerk_id()) WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY pages_owner_insert ON public.pages FOR INSERT TO authenticated
    WITH CHECK (created_by = public.current_clerk_id());
CREATE UNIQUE INDEX library_fixture_page_positions ON public.pages (book_id, page_number);

INSERT INTO public.books (id, created_by, status, is_public, total_pages) VALUES
  ('10000000-0000-4000-8000-000000000000', 'owner', 'complete', true, 2),
  ('20000000-0000-4000-8000-000000000000', 'owner', 'draft', false, 2),
  ('30000000-0000-4000-8000-000000000000', 'owner', 'draft', false, 2),
  ('40000000-0000-4000-8000-000000000000', 'owner', 'draft', false, 2),
  ('50000000-0000-4000-8000-000000000000', 'second-owner', 'draft', false, 2);
INSERT INTO public.pages (id, book_id, created_by, page_number, text_content, image_url) VALUES
  ('11000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000000', 'owner', 4, 'First page', 'cover'),
  ('12000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000000', 'owner', 9, 'Second page', null),
  ('13000000-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000000', 'owner', 10, E' \t\n', null),
  ('21000000-0000-4000-8000-000000000000', '20000000-0000-4000-8000-000000000000', 'owner', 0, 'First page', 'cover'),
  ('41000000-0000-4000-8000-000000000000', '40000000-0000-4000-8000-000000000000', 'owner', 0, 'Different page', 'cover');
