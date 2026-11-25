\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', label; END IF;
END $$;
-- First phase: the initially public book, listing and comment are readable.
SET ROLE anon;
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.public_books WHERE id=1), 'anon public book missing');
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.community WHERE id=10), 'anon public listing missing');
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.comments WHERE id=10), 'anon public comment missing');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','stranger',false) IS NOT NULL;
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.public_books WHERE id=1), 'stranger public book missing');
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.community WHERE id=10), 'stranger public listing missing');
SELECT pg_temp.assert_true(EXISTS (SELECT FROM public.comments WHERE id=10), 'stranger public comment missing');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.books WHERE id=1), 'books owner-only RLS missing');
RESET ROLE;
UPDATE public.books SET is_public=false WHERE id=1;
-- A late insert by the owner models the cleanup race. The old row remains too.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','owner',false) IS NOT NULL;
INSERT INTO public.community VALUES (11,1,'stale public title','public','owner');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false) IS NOT NULL;
SET ROLE anon;
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.community WHERE title='stale public title'), 'stale public title visible to anon');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.community WHERE id IN (10,30,40)), 'anon stale, private-book or orphan listing visible');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.comments WHERE id IN (10,30,40,60,70)), 'anon hidden post comments visible');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.community WHERE id IN (20,50))=2, 'anon valid public posts missing');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.comments WHERE id IN (20,50))=2, 'anon valid public comments missing');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.public_books WHERE id IN (1,3)) AND EXISTS (SELECT FROM public.public_books WHERE id=2), 'anon public_books privacy');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.public_pages WHERE book_id IN (1,3)) AND EXISTS (SELECT FROM public.public_pages WHERE book_id=2), 'anon public_pages privacy');
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','stranger',false) IS NOT NULL;
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.community WHERE id IN (10,11,30,40,60,70)), 'stranger hidden posts visible');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.comments WHERE id IN (10,30,40,60,70)), 'stranger hidden comments visible');
SELECT pg_temp.assert_true((SELECT count(*) FROM public.community WHERE id IN (20,50))=2 AND (SELECT count(*) FROM public.comments WHERE id IN (20,50))=2, 'stranger valid public content missing');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.public_books WHERE id IN (1,3)) AND NOT EXISTS (SELECT FROM public.public_pages WHERE book_id IN (1,3)), 'stranger public views expose private book');
SELECT set_config('request.jwt.claim.sub','owner',false) IS NOT NULL;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.community WHERE id IN (10,11,30,40,60,70))=6, 'owner must see own posts for cleanup');
SELECT pg_temp.assert_true(NOT EXISTS (SELECT FROM public.comments WHERE id IN (10,30,40,60,70)), 'post owner can read others hidden comments');
SELECT set_config('request.jwt.claim.sub','commenter',false) IS NOT NULL;
SELECT pg_temp.assert_true((SELECT count(*) FROM public.comments WHERE id IN (10,30,40,60,70))=5, 'comment owner cannot see own comments');
RESET ROLE;
\echo PASS: public sharing privacy regression
