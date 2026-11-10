-- Storage lockdown for bucket sipurai-images (children's illustrations).
-- Measured before: an anonymous visitor could LIST every object and could UPLOAD (policies sipurai_public_read and
-- sipurai_public_insert applied to anon). Every object since the Clerk migration (103 of 103) was uploaded by a signed-in
-- user (owner_id is a Clerk sub); the 11 without an owner all date from 2026-03-16, before Clerk. So no production path
-- uploads as anon.
--
-- After this: anon can neither list nor upload. Signed-in users (role authenticated) can upload, and can see (list) only
-- their own objects. Images keep loading by public URL because the bucket is public: that path does not use these policies.
-- STILL TRUE AFTERWARDS: anyone who has the URL of an image can open it.
--
-- Restore the previous state exactly with docs/storage-policies-before-2026-11-10.sql (drop the two new policies first).
begin;

drop policy if exists "sipurai_public_insert" on storage.objects;
drop policy if exists "sipurai_public_read" on storage.objects;

create policy "sipurai_authenticated_insert" on storage.objects
  as permissive for insert to authenticated
  with check (bucket_id = 'sipurai-images');

-- Also needed so the INSERT ... RETURNING that Storage performs passes row level security.
create policy "sipurai_owner_select" on storage.objects
  as permissive for select to authenticated
  using (bucket_id = 'sipurai-images' and owner_id = (select auth.jwt() ->> 'sub'));

-- Assert: no policy on this bucket applies to anon, and exactly the two new ones exist.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and roles::text like '%anon%') then
    raise exception 'storage lockdown: a policy still applies to anon';
  end if;
  if (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') <> 2 then
    raise exception 'storage lockdown: unexpected number of policies';
  end if;
end $$;

commit;
