-- Revert the application switch to these functions first.
-- Keep the production SELECT privacy guards in place.
BEGIN;
DROP FUNCTION IF EXISTS public.sipurai_publish_book(uuid, boolean, jsonb);
DROP FUNCTION IF EXISTS public.sipurai_unshare_book(uuid, text);
DROP POLICY IF EXISTS community_owned_book_insert ON public.community;
DROP POLICY IF EXISTS community_owned_book_update ON public.community;
DROP FUNCTION IF EXISTS sipurai_private.book_has_listings(uuid);
DROP SCHEMA IF EXISTS sipurai_private;
COMMIT;
