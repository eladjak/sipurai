-- Parental privacy consent ("privacy gate"). One row = one parent accepted one policy version.
-- ADDITIVE ONLY: one new table. Touches no existing table.
-- Rollback: scripts/migrations/2026-11-10-privacy-consents.rollback.sql
-- Only the service role (the Vercel API) may read or write it. RLS is on with no policies,
-- and every privilege is revoked from anon/authenticated (same pattern as the quota tables).

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
revoke all on public.privacy_consents from anon, authenticated;
revoke all on sequence public.privacy_consents_id_seq from anon, authenticated;
