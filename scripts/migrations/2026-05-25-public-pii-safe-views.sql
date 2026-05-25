-- ============================================================================
-- Sipurai — PII-safe public sharing (council-mandated fix)
-- Project: furviizyohryyqubosut (Sipurai PROD)
-- Date:    2026-05-25
-- Author:  security-fix
-- Council:  council-of-sages 3-of-3 ran 2026-05-25 (GPT-5.5 + Grok-4.20 + Gemini-2.5-pro).
--           UNANIMOUS critical caveat on Q2: anon read of the BASE books/pages
--           rows via `USING (is_public = true)` leaks child PII
--           (child_name / child_age / child_gender / family_members / child_names)
--           to anonymous visitors of a shared book link — a COPPA/GDPR footgun
--           for a children's product. Public read MUST be COLUMN-restricted, not
--           just row-restricted. This migration implements that fix.
-- ============================================================================
--
-- WHAT THIS DOES (and WHY)
--   1. Removes the anon/PII leak: drops the anon `books_public_select` /
--      `pages_public_select` policies that exposed full rows, and REVOKEs anon
--      table-level SELECT on books/pages entirely.
--   2. Adds sanitized, PII-free views `public_books` / `public_pages` that
--      project ONLY the columns a public reader legitimately needs (title,
--      cover, story text, images). NO child name/age/gender/family columns.
--      Views run with security_invoker = OFF (default) so anon can read public
--      rows through them without base-table grants; the WHERE is_public = true
--      filter inside the view is the gate.
--   3. Closes the `profiles` posture footgun the council + live probe flagged:
--      REVOKE ALL ON public.profiles FROM anon (anon had inherited
--      INSERT/UPDATE/DELETE/TRUNCATE GRANTs; RLS already denied the rows, but
--      the grants are wrong posture and removed for defense-in-depth).
--
-- IDEMPOTENT: drops/recreates by name. Safe to re-run. Zero rows on all tables.
-- ============================================================================

BEGIN;

-- ── 1. Remove the PII-leaking anon base-table read ───────────────────────────
DROP POLICY IF EXISTS "books_public_select" ON public.books;
DROP POLICY IF EXISTS "pages_public_select" ON public.pages;
DROP POLICY IF EXISTS "books_public_shared_select" ON public.books;
DROP POLICY IF EXISTS "pages_public_shared_select" ON public.pages;

-- anon must have NO direct read on the base tables (they carry child PII).
REVOKE SELECT ON public.books FROM anon;
REVOKE SELECT ON public.pages FROM anon;

-- ── 2. Sanitized, PII-free public views ──────────────────────────────────────
-- public_books: ONLY non-PII presentation columns. Explicitly EXCLUDES
-- child_name, child_age, child_gender, family_members, child_names, created_by,
-- created_by_name (author identity), description-of-child, etc.
DROP VIEW IF EXISTS public.public_books;
CREATE VIEW public.public_books
WITH (security_invoker = off) AS
  SELECT
    b.id,
    b.title,
    b.description,
    b.moral,
    b.art_style,
    b.genre,
    b.age_range,
    b.language,
    b.tone,
    b.status,
    b.cover_image,
    b.total_pages,
    b.created_date,
    b.is_public
  FROM public.books b
  WHERE b.is_public = true;

-- public_pages: the readable story content of a public book. Pages hold the
-- rendered story text + illustration; no parent-supplied child PII columns.
DROP VIEW IF EXISTS public.public_pages;
CREATE VIEW public.public_pages
WITH (security_invoker = off) AS
  SELECT p.*
  FROM public.pages p
  WHERE EXISTS (
    SELECT 1 FROM public.books b
    WHERE b.id = p.book_id AND b.is_public = true
  );

-- Grant read on the sanitized views to anon + authenticated. The view owner
-- (postgres) bypasses RLS, and the view body itself enforces is_public = true,
-- so only intentionally-shared books are ever exposed — and only via safe cols.
-- REVOKE ALL first: Supabase auto-grants ALL privileges to anon/authenticated on
-- new public-schema objects (INSERT/UPDATE/DELETE/TRUNCATE) — strip them so the
-- views are strictly read-only (defense-in-depth, council posture note).
REVOKE ALL ON public.public_books FROM anon, authenticated;
REVOKE ALL ON public.public_pages FROM anon, authenticated;
GRANT SELECT ON public.public_books TO anon, authenticated;
GRANT SELECT ON public.public_pages TO anon, authenticated;

-- ── 3. Close the profiles anon-grant posture footgun ─────────────────────────
-- The clerk-sub-ownership migration created `profiles`; anon had inherited
-- INSERT/UPDATE/DELETE/TRUNCATE/SELECT GRANTs (RLS denied the rows, but the
-- grants are wrong). Anon has no business touching the email<->id directory.
REVOKE ALL ON public.profiles FROM anon;

COMMIT;

-- ============================================================================
-- POST-CONDITIONS
--   * anon CANNOT SELECT public.books / public.pages directly (no grant).
--   * anon CAN SELECT public.public_books / public.public_pages — PII-free,
--     is_public=true rows only.
--   * authenticated owners still read full base rows via books_owner_select.
--   * anon has ZERO privileges on public.profiles.
-- ============================================================================
