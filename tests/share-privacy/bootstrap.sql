\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION public.current_clerk_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')
$$;
CREATE TABLE public.books (id integer PRIMARY KEY, title text NOT NULL, created_by text NOT NULL, is_public boolean NOT NULL);
CREATE TABLE public.pages (id integer PRIMARY KEY, book_id integer NOT NULL, text_content text NOT NULL);
CREATE TABLE public.community (id integer PRIMARY KEY, book_id integer, title text NOT NULL, visibility text NOT NULL, created_by text NOT NULL);
CREATE TABLE public.comments (id integer PRIMARY KEY, community_id integer NOT NULL, body text NOT NULL, created_by text NOT NULL);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_owner_select ON public.books FOR SELECT TO authenticated USING (created_by = public.current_clerk_id());
CREATE POLICY community_public_select ON public.community FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY community_owner_select ON public.community FOR SELECT TO authenticated USING (created_by = public.current_clerk_id());
CREATE POLICY community_owner_insert ON public.community FOR INSERT TO authenticated WITH CHECK (created_by = public.current_clerk_id());
CREATE POLICY comments_public_select ON public.comments FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.community c WHERE c.id = comments.community_id AND c.visibility = 'public'));
CREATE POLICY comments_owner_select ON public.comments FOR SELECT TO authenticated USING (created_by = public.current_clerk_id());
CREATE VIEW public.public_books WITH (security_invoker = off) AS SELECT id, title, is_public FROM public.books WHERE is_public = true;
CREATE VIEW public.public_pages WITH (security_invoker = off) AS SELECT p.id, p.book_id, p.text_content FROM public.pages p WHERE EXISTS (SELECT 1 FROM public.books b WHERE b.id = p.book_id AND b.is_public = true);
GRANT SELECT ON public.books TO authenticated;
GRANT SELECT ON public.community, public.comments, public.public_books, public.public_pages TO anon, authenticated;
GRANT INSERT ON public.community TO authenticated;
INSERT INTO public.books VALUES (1,'formerly public','owner',true),(2,'still public','owner',true),(3,'always private','owner',false);
INSERT INTO public.pages VALUES (1,1,'former page'),(2,2,'public page'),(3,3,'private page');
INSERT INTO public.community VALUES
 (10,1,'original public listing','public','owner'),
 (20,2,'other public listing','public','owner'),
 (30,3,'private book listing','public','owner'),
 (40,999,'orphan listing','public','owner'),
 (50,NULL,'bookless public','public','owner'),
 (60,NULL,'bookless private','private','owner'),
 (70,2,'private post','private','owner');
INSERT INTO public.comments VALUES
 (10,10,'former comment','commenter'),(20,20,'public comment','commenter'),
 (30,30,'private book comment','commenter'),(40,40,'orphan comment','commenter'),
 (50,50,'bookless comment','commenter'),(60,60,'private post comment','commenter'),
 (70,70,'private linked post comment','commenter');
