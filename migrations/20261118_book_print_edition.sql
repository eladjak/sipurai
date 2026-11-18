BEGIN;
SET LOCAL lock_timeout = '3s';
-- Private owner-edited print review. public_books and public_pages keep
-- their existing explicit projections and continue to exclude this data.
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS print_edition jsonb;

COMMENT ON COLUMN public.books.print_edition IS
  'Private print preparation only. Never surface through public views or order settings.';

COMMIT;
