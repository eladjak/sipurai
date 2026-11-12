-- Book deletion in ONE transaction (12.11.2026). NOT APPLIED by the build: the orchestrator applies it.
--
-- Why: the old JS deleted comments, posts, collaborations, pages and the book as separate requests, so a
-- failure half way left a book without pages. Now authorization, the open-print-order check and every row
-- delete happen inside this single function (= one transaction), with the book row locked FOR UPDATE.
--
-- It returns the storage object paths the caller may remove afterwards: paths named by the book's cover or
-- pages, whose storage owner (storage.objects.owner_id, written by Storage from the verified JWT) is p_user,
-- and that no remaining book cover, page image, character image or profile avatar still points at.
-- The caller (api/_lib/bookControls.js) removes those files; if that fails the book is already gone and the
-- paths are logged so they can be cleaned up.
--
-- Known limit: a print order created in the same instant by another request does not take this lock.
-- Orders are created through the server for the book's owner, who is the one deleting; accepted.

-- Object path inside the bucket from either stored URL form (old public URL or /api/img?p=...), or NULL.
-- Measured on the live data: every path is generated/<[A-Za-z0-9._-]+> and no stored URL is percent-encoded
-- except the %2F of the proxy form, which is normalised here. Anything else yields NULL = "not collected / not
-- counted as a reference to a different file", which only ever errs on the side of keeping a file.
create or replace function public.sipurai_image_path(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select substring(
    replace(replace(coalesce(p_url, ''), '%2F', '/'), '%2f', '/')
    from '(?:/sipurai-images/|[?&]p=)((?:generated|uploads)/[A-Za-z0-9._/-]+)'
  )
$$;
revoke all on function public.sipurai_image_path(text) from public, anon, authenticated;
grant execute on function public.sipurai_image_path(text) to service_role;

create or replace function public.sipurai_delete_book(p_book uuid, p_user text)
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner text;
  v_open integer := 0;
  v_paths text[];
begin
  if p_user is null or p_user = '' then
    raise exception 'sipurai_not_found';
  end if;

  select b.created_by into v_owner from public.books b where b.id = p_book for update;
  if not found or v_owner is distinct from p_user then
    raise exception 'sipurai_not_found';
  end if;

  -- Same rule the JS used: these statuses mean a printed copy is still on its way.
  if to_regclass('public.print_orders') is not null then
    execute 'select count(*) from public.print_orders where book_id = $1 and user_id = $2 '
         || 'and status in (''paid'',''submitting'',''submitted'',''in_production'',''failed_needs_attention'')'
      into v_open using p_book::text, p_user;
  end if;
  if v_open > 0 then
    raise exception 'sipurai_open_order';
  end if;

  select coalesce(array_agg(distinct x.path), '{}') into v_paths
  from (
    select public.sipurai_image_path(b.cover_image) as path from public.books b where b.id = p_book
    union all
    select public.sipurai_image_path(pg.image_url) from public.pages pg where pg.book_id = p_book
  ) x
  where x.path is not null;

  delete from public.comments where community_id in (select c.id from public.community c where c.book_id = p_book);
  delete from public.community where book_id = p_book;
  if to_regclass('public.collaborations') is not null then
    execute 'delete from public.collaborations where book_id = $1' using p_book;
  end if;
  delete from public.pages where book_id = p_book;
  delete from public.books where id = p_book;

  return query
  select p.path
  from unnest(v_paths) as p(path)
  where exists (
          select 1 from storage.objects o
          where o.bucket_id = 'sipurai-images' and o.name = p.path and o.owner_id = p_user)
    and not exists (select 1 from public.books b2 where public.sipurai_image_path(b2.cover_image) = p.path)
    and not exists (select 1 from public.pages g2 where public.sipurai_image_path(g2.image_url) = p.path)
    and not exists (select 1 from public.characters ch where public.sipurai_image_path(ch.primary_image_url) = p.path)
    and not exists (select 1 from public.profiles pr where public.sipurai_image_path(pr.avatar_url) = p.path);
end;
$$;
revoke all on function public.sipurai_delete_book(uuid, text) from public, anon, authenticated;
grant execute on function public.sipurai_delete_book(uuid, text) to service_role;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_function_privilege(r, 'public.sipurai_delete_book(uuid,text)', 'execute') then
      raise exception 'sipurai_delete_book: role % can execute it', r;
    end if;
    if has_function_privilege(r, 'public.sipurai_image_path(text)', 'execute') then
      raise exception 'sipurai_image_path: role % can execute it', r;
    end if;
  end loop;
  if not has_function_privilege('service_role', 'public.sipurai_delete_book(uuid,text)', 'execute') then
    raise exception 'sipurai_delete_book: service_role cannot execute it';
  end if;
end $$;
