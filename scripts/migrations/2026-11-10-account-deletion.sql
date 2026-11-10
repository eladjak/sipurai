-- Support for "delete my account and data". ADDITIVE ONLY: one new table, one new function.
-- Rollback: scripts/migrations/2026-11-10-account-deletion.rollback.sql
-- Service role only (the Vercel API). Asserts the effective privileges at the end.

begin;

-- A tombstone written BEFORE anything is deleted. It keeps the identifiers a retry needs (the Clerk id
-- and the email, which is how subscriptions are found) after the profile row is gone. It is removed as
-- the very last step. While it exists the consent endpoint refuses to record a new acceptance.
create table if not exists public.account_deletions (
  user_id    text primary key,                      -- Clerk sub
  email      text,
  status     text        not null default 'deleting',
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);
alter table public.account_deletions enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'account_deletions'
  loop
    execute format('drop policy %I on public.account_deletions', pol.policyname);
  end loop;
end $$;
revoke all on public.account_deletions from public, anon, authenticated;

-- Files that provably belong to one user. storage.objects.owner_id is written by Supabase Storage from the
-- verified JWT `sub` at upload time, so a client cannot choose it. Unlike scanning URLs inside rows, this
-- also finds uploads no row refers to, and a user cannot plant a reference to someone else's file.
create or replace function public.sipurai_owned_storage_paths(p_user text)
returns table(name text)
language sql
security definer
set search_path = ''
stable
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'sipurai-images'
    and p_user is not null and p_user <> ''
    and o.owner_id = p_user
$$;
revoke all on function public.sipurai_owned_storage_paths(text) from public, anon, authenticated;
grant execute on function public.sipurai_owned_storage_paths(text) to service_role;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.account_deletions', 'select')
       or has_table_privilege(r, 'public.account_deletions', 'insert')
       or has_table_privilege(r, 'public.account_deletions', 'update')
       or has_table_privilege(r, 'public.account_deletions', 'delete') then
      raise exception 'account_deletions: role % has table privileges', r;
    end if;
    if has_function_privilege(r, 'public.sipurai_owned_storage_paths(text)', 'execute') then
      raise exception 'sipurai_owned_storage_paths: role % can execute it', r;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'account_deletions') then
    raise exception 'account_deletions: an unexpected policy exists';
  end if;
end $$;

commit;
