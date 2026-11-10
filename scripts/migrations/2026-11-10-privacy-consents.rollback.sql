-- Rollback for 2026-11-10-privacy-consents.sql. Drops only the table that migration created.
-- Warning: this deletes every recorded consent; the gate will then ask every parent again.
drop table if exists public.privacy_consents;
