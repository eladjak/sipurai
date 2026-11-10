-- Parental privacy consent ("privacy gate"). One row = one parent accepted one policy version.
-- ADDITIVE ONLY: one new table. Touches no other table.
-- Rollback: scripts/migrations/2026-11-10-privacy-consents.rollback.sql
-- Only the service role (the Vercel API) may read or write it. Hardened so it is also safe when the
-- table already exists: every policy is dropped, privileges are revoked from PUBLIC, anon and
-- authenticated, and the migration ASSERTS the effective state at the end (it fails, and rolls back,
-- if a client role could still touch the table).

begin;

create table if not exists public.privacy_consents (
  id             bigserial primary key,
  user_id        text        not null,               -- Clerk sub (never an email)
  policy_version text        not null,               -- e.g. '2026-11-10', one constant in api/_lib/policyVersion.js
  accepted_at    timestamptz not null default now(),
  items          jsonb       not null,               -- {"guardian_18": true, "policy_and_terms": true}
  locale         text,                               -- 'he' | 'en' | 'yi' as shown to the parent
  user_agent     text,                               -- truncated server side to 300 chars
  constraint privacy_consents_one_per_version unique (user_id, policy_version)
);
create index if not exists privacy_consents_user_idx on public.privacy_consents (user_id, accepted_at desc);

alter table public.privacy_consents enable row level security;

-- No client policy may exist: drop whatever is there (an existing table may carry policies).
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'privacy_consents'
  loop
    execute format('drop policy %I on public.privacy_consents', pol.policyname);
  end loop;
end $$;

revoke all on public.privacy_consents from public, anon, authenticated;
revoke all on sequence public.privacy_consents_id_seq from public, anon, authenticated;

-- Assert the effective state. Any failure aborts the whole migration.
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if has_table_privilege(r, 'public.privacy_consents', 'select')
       or has_table_privilege(r, 'public.privacy_consents', 'insert')
       or has_table_privilege(r, 'public.privacy_consents', 'update')
       or has_table_privilege(r, 'public.privacy_consents', 'delete') then
      raise exception 'privacy_consents: role % still has table privileges', r;
    end if;
  end loop;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'privacy_consents') then
    raise exception 'privacy_consents: an unexpected policy exists';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.privacy_consents'::regclass) then
    raise exception 'privacy_consents: RLS is not enabled';
  end if;
  if exists (select 1 from pg_class c, aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
             where c.oid = 'public.privacy_consents'::regclass and a.grantee = 0) then
    raise exception 'privacy_consents: PUBLIC still holds a privilege';
  end if;
end $$;

commit;
