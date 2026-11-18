CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.books (id uuid PRIMARY KEY,created_by text NOT NULL,title text,description text,moral text,art_style text,length text,genre text,age_range text,language text,child_name text,child_age integer,child_gender text,tone text,interests text,family_members text,status text,cover_image text,total_pages integer,child_names jsonb,selected_characters jsonb,is_public boolean,print_size text,print_edition jsonb);
CREATE TABLE public.pages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_by text NOT NULL,book_id uuid NOT NULL,page_number integer NOT NULL,text_content text,image_url text,image_prompt text,layout_type text);
INSERT INTO public.books (id,created_by,status,cover_image,is_public,total_pages) VALUES ('11111111-1111-4111-8111-111111111111','owner','draft','',true,2);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.books,public.pages TO service_role;

CREATE TABLE public.book_quota_reservations(user_id text NOT NULL, book_key text NOT NULL, UNIQUE(user_id,book_key));
INSERT INTO public.book_quota_reservations VALUES ('owner','11111111-1111-4111-8111-111111111111'),('owner','22222222-2222-4222-8222-222222222222'),('owner','33333333-3333-4333-8333-333333333333'),('owner','55555555-5555-4555-8555-555555555555');
