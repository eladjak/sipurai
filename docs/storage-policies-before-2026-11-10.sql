-- BEFORE-STATE of the storage policies on project furviizyohryyqubosut, read from pg_policies on 2026-11-10,
-- before any change. Restoring this file's statements restores exactly the previous behaviour.
-- Bucket: sipurai-images, public=true, file_size_limit=10485760,
--         allowed_mime_types={image/png,image/jpeg,image/webp,image/gif,image/svg+xml,application/pdf}
-- Table grants on storage.objects (unchanged by the work): anon and authenticated hold DELETE,INSERT,SELECT,UPDATE;
-- with row level security on and only these two policies, only SELECT and INSERT were possible for them.

create policy "sipurai_public_insert" on storage.objects
  as permissive for insert to anon, authenticated
  with check (bucket_id = 'sipurai-images'::text);

create policy "sipurai_public_read" on storage.objects
  as permissive for select to anon, authenticated
  using (bucket_id = 'sipurai-images'::text);
