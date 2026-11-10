-- PROPOSED, NOT APPLIED. Needs the owner's approval: it changes a production storage policy.
--
-- Today (measured read-only on 2026-11-10): an anonymous visitor can LIST every object in the public bucket
-- `sipurai-images` (114 objects, all children's illustrations under generated/), and anyone can UPLOAD to it
-- (policy sipurai_public_insert applies to anon). So the sentence "nothing is public unless you share it" is NOT true.
--
-- This removes only the anonymous/authenticated LISTING policy. Objects keep loading in the app because the bucket
-- is public: direct URLs under /storage/v1/object/public/... do not use the SELECT policy. The app never lists
-- the bucket (grep for storage.from / .list( in src shows none).
--
-- Not enough by itself: images stay reachable to anyone who has a URL. Making the bucket private with signed URLs is
-- the real fix and is a bigger change (every <img> needs a signed URL).
begin;
drop policy if exists "sipurai_public_read" on storage.objects;
commit;
-- Rollback:
--   create policy "sipurai_public_read" on storage.objects for select to anon, authenticated
--     using (bucket_id = 'sipurai-images');
