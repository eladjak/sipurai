-- Make bucket sipurai-images PRIVATE. Images are read through GET /api/img (service role) from now on.
-- Before: anyone with an image URL could open it, including drawings of a child made from a photo, for books never shared.
-- Apply this AFTER the code that serves /api/img is deployed, otherwise images in the app stop loading.
-- Idempotent: running it twice changes nothing the second time.
begin;

-- Owner lookup used by /api/img (service role only), same pattern as sipurai_owned_storage_paths.
create or replace function public.sipurai_object_owner(p_name text)
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select o.owner_id
  from storage.objects o
  where o.bucket_id = 'sipurai-images' and o.name = p_name
  limit 1
$$;
revoke all on function public.sipurai_object_owner(text) from public, anon, authenticated;
grant execute on function public.sipurai_object_owner(text) to service_role;

-- Stored URLs: .../storage/v1/object/public/sipurai-images/<path>  ->  /api/img?p=<urlencoded path>
-- '/' is encoded as %2F, exactly like imageProxyUrl() does. Paths are [A-Za-z0-9._-] plus '/', so only '/' needs encoding.
update public.books
   set cover_image = '/api/img?p=' || replace(substring(cover_image from '/storage/v1/object/public/sipurai-images/([^?#]+)'), '/', '%2F')
 where cover_image like '%/storage/v1/object/public/sipurai-images/%';

update public.pages
   set image_url = '/api/img?p=' || replace(substring(image_url from '/storage/v1/object/public/sipurai-images/([^?#]+)'), '/', '%2F')
 where image_url like '%/storage/v1/object/public/sipurai-images/%';

update public.characters
   set primary_image_url = '/api/img?p=' || replace(substring(primary_image_url from '/storage/v1/object/public/sipurai-images/([^?#]+)'), '/', '%2F')
 where primary_image_url like '%/storage/v1/object/public/sipurai-images/%';

update storage.buckets set public = false where id = 'sipurai-images';

-- Assert
do $$
begin
  if (select public from storage.buckets where id = 'sipurai-images') is distinct from false then
    raise exception 'private-images: bucket is still public';
  end if;
  if exists (select 1 from public.books where cover_image like '%/storage/v1/object/public/sipurai-images/%')
     or exists (select 1 from public.pages where image_url like '%/storage/v1/object/public/sipurai-images/%')
     or exists (select 1 from public.characters where primary_image_url like '%/storage/v1/object/public/sipurai-images/%') then
    raise exception 'private-images: a public URL is still stored';
  end if;
  if has_function_privilege('anon', 'public.sipurai_object_owner(text)', 'execute')
     or has_function_privilege('authenticated', 'public.sipurai_object_owner(text)', 'execute') then
    raise exception 'private-images: sipurai_object_owner is executable by a client role';
  end if;
end $$;

commit;
