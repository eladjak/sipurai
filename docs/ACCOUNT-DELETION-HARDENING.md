# Account deletion: hardening plan (follow-up PR)

Status: the deletion code (`api/account/delete.js`, `api/_lib/accountDeletion.js`, `src/components/settings/DeleteAccountCard.jsx`)
is **parked**. It is unreachable while `ACCOUNT_DELETE_ENABLED` (server) and `VITE_ACCOUNT_DELETE_ENABLED` (browser) are not `true`.
With both off the route answers 503 `disabled` before any auth, database, storage, Clerk or network call
(test: `PARKED: with the switches off the route makes zero ... calls`), and Settings shows only "write to support@sipurai.ai".
Do not turn the switches on until every item below is done and tested on a throwaway account.

Source: second adversarial review (Codex), `/root/work/sipurai-gate-codex2.out`, plus the first review. Items 1-5, 7, 9 are open.
Item 6 (storage exposure) was fixed in this PR's storage migration; item 8 (cleanup script) was removed from the PR.

| # | Finding | Planned fix | How it will be proved |
|---|---|---|---|
| 1 HIGH | Consent can be recreated while deletion runs: `recordConsent` checks the marker and saves in two steps; `requireConsent` ignores the marker; `remaining()` does not count consent rows | One database function `sipurai_record_consent(user, version, items, ...)` that locks the user's marker row (`select ... for update` on `account_deletions` keyed by user) and inserts the consent in the same transaction, refusing if a marker exists. `requireConsent` and `hasConsent` also treat a marker as "no consent". `remaining()` counts `privacy_consents`. | Test with two real concurrent database transactions (accept vs. mark); test that a consent row with a marker present is still refused |
| 2 HIGH | Writers and paid operations race the blocker check and the final verification (an already-authorized request can create an order, reserve a book, write rows or upload after the checks); order status can change between read and update | A per-user deletion barrier in the database: marker row checked by every server writer (`reserve`, `orders/create`, payment transitions, webhooks) inside the same transaction; deletion takes the same lock, drains in-flight work, then verifies. Order anonymization becomes `update ... where user_id = $1 and status = any($allowed)` and checks the affected-row count. Direct browser writes: RLS policies on the 11 tables get `not exists (select 1 from account_deletions where user_id = created_by)` | Concurrent-transaction tests for each writer; a test that an order moving to `paid` after the blocker check aborts the deletion |
| 3 HIGH | Storage inventory by `owner_id` misses files without the user's owner id (anonymous uploads, service-role uploads, older flows) | Facts measured on 2026-11-10: 114 objects, 103 owned by a Clerk sub (all uploads since the Clerk migration), 11 without owner (all 2026-03-16, before Clerk). Plan: a user-bound asset registry table written by the server for every new upload (owner, path, created); a one-off reconciliation of the 11 legacy objects by hand with the owner; deletion refuses to report "complete" while unresolved assets exist | Registry test; reconciliation report reviewed by Elad |
| 4 HIGH | Subscriptions are found by profile email (stale, shared, case variants; a missing email is treated as "no subscription") | Add an immutable `clerk_id` column to `subscriptions` (backfill from `profiles`, set by the webhook), query and delete by it. Until a user has a resolved subscription state, deletion fails closed (does not treat a missing email as free) | Tests: missing email blocks; two accounts sharing an email do not delete each other's rows |
| 5 HIGH | Finished-order anonymization copies the whole `quote` JSON, clears only `bookTitle`, and `remaining()` only checks the old user id | Whitelist: keep only `currency`, `lines` (names and amounts), `totalAgorot`, `vatIncluded`, `priceVersion`, `presetId`, `qty`, `method`; everything else becomes null. `remaining()` verifies the sanitized shape, not just the id. Update is conditional on user and status | Test with a quote containing an address and a child's name: neither survives; verification fails if one does |
| 7 MEDIUM | A successful identity deletion can leave a permanent marker (user id + email) if clearing it fails or the response is lost | Durable server-side finalization job (a retryable step that does not need the deleted user's session), a monitor that lists markers older than 1 hour, and the marker stops holding the email after the data purge (keep only the id and status) | Test: Clerk succeeds, clear fails, a later job run clears it |
| 9 MEDIUM | `create table if not exists` does not validate existing columns, constraints or the sequence | Migrations assert required columns, types, nullability, the `(user_id, policy_version)` unique constraint and sequence ownership, and abort on mismatch; tested against a clean database and a representative old schema | Migration tests |

Also planned: a real end-to-end run on a throwaway Clerk user and throwaway rows/objects before the switches are turned on.

## What the storage migration changed and what is still exposed (this PR)
- Before: anonymous visitors could list all objects and upload. After (`2026-11-10-storage-lockdown.sql`): anonymous list and upload are denied;
  signed-in users can upload and see only their own objects. Measurements: `docs/storage-measurements-before.txt` and `-after.txt`.
  Exact restore: `docs/storage-policies-before-2026-11-10.sql`.
- Still true: the bucket is public. Anyone who has the URL of an image can open it. A private bucket with short-lived signed URLs
  is the real fix. Estimate: 4 to 8 hours and about 12 files (the upload helper, `Core.GenerateImage`, every place that renders
  `cover_image`, `image_url`, `primary_image_url`, avatars, the PDF and print export that fetch images, a signed-URL endpoint,
  a migration of the 114 existing objects, and tests), plus a data-migration window.
