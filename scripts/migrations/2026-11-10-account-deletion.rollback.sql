-- Rollback for 2026-11-10-account-deletion.sql. Drops only what that migration created.
-- Warning: removes the tombstones of any deletion still in progress.
drop function if exists public.sipurai_owned_storage_paths(text);
drop table if exists public.account_deletions;
