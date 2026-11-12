-- Rollback of 2026-11-12-private-images.sql: bucket public again, stored URLs back to the public form.
-- Rewrites only URLs of the form /api/img?p=<encoded path>. Idempotent.
begin;

update storage.buckets set public = true where id = 'sipurai-images';

update public.books
   set cover_image = 'https://furviizyohryyqubosut.supabase.co/storage/v1/object/public/sipurai-images/' || replace(substring(cover_image from '^/api/img\?p=([^&#]+)$'), '%2F', '/')
 where cover_image ~ '^/api/img\?p=[^&#]+$';

update public.pages
   set image_url = 'https://furviizyohryyqubosut.supabase.co/storage/v1/object/public/sipurai-images/' || replace(substring(image_url from '^/api/img\?p=([^&#]+)$'), '%2F', '/')
 where image_url ~ '^/api/img\?p=[^&#]+$';

update public.characters
   set primary_image_url = 'https://furviizyohryyqubosut.supabase.co/storage/v1/object/public/sipurai-images/' || replace(substring(primary_image_url from '^/api/img\?p=([^&#]+)$'), '%2F', '/')
 where primary_image_url ~ '^/api/img\?p=[^&#]+$';

drop function if exists public.sipurai_object_owner(text);

commit;
