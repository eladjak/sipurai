-- Extend the existing trim catalogue, keeping all historical values valid.
-- Ordering is governed by the separate priced-products list.
BEGIN;
SET LOCAL lock_timeout = '3s';

ALTER TABLE public.books ADD CONSTRAINT books_print_size_spx
  CHECK (print_size IS NULL OR print_size IN (
    'square-220', 'square-200', 'portrait-165x235', 'landscape-210x170'
  ));
ALTER TABLE public.books DROP CONSTRAINT books_print_size_check;
ALTER TABLE public.books RENAME CONSTRAINT books_print_size_spx TO books_print_size_check;

CREATE OR REPLACE FUNCTION public.guard_book_print_aspect()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE
  old_aspect text := CASE OLD.print_size
    WHEN 'portrait-165x235' THEN 'portrait'
    WHEN 'landscape-210x170' THEN 'landscape'
    ELSE 'square'
  END;
  new_aspect text := CASE NEW.print_size
    WHEN 'portrait-165x235' THEN 'portrait'
    WHEN 'landscape-210x170' THEN 'landscape'
    ELSE 'square'
  END;
BEGIN
  IF old_aspect <> new_aspect AND (
    NULLIF(OLD.cover_image, '') IS NOT NULL OR
    EXISTS (SELECT FROM public.pages WHERE book_id = OLD.id AND NULLIF(image_url, '') IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot change book aspect after illustrations exist';
  END IF;
  RETURN NEW;
END $$;
COMMIT;
