-- Apply before deploying the size-selection UI. Existing books remain NULL (legacy square).
ALTER TABLE public.books ADD COLUMN IF NOT EXISTS print_size text;
ALTER TABLE public.books ADD CONSTRAINT books_print_size_check
  CHECK (print_size IS NULL OR print_size IN ('square-220', 'square-200', 'portrait-165x235'));

-- Illustration geometry is immutable once artwork exists. NULL represents legacy square.
CREATE OR REPLACE FUNCTION public.guard_book_print_aspect() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (COALESCE(OLD.print_size, 'square-220') = 'portrait-165x235') IS DISTINCT FROM
     (COALESCE(NEW.print_size, 'square-220') = 'portrait-165x235') AND
     (NULLIF(OLD.cover_image, '') IS NOT NULL OR EXISTS
       (SELECT 1 FROM public.pages WHERE book_id = OLD.id AND NULLIF(image_url, '') IS NOT NULL)) THEN
    RAISE EXCEPTION 'Cannot change book aspect after illustrations exist';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_book_print_aspect ON public.books;
CREATE TRIGGER guard_book_print_aspect BEFORE UPDATE OF print_size ON public.books
  FOR EACH ROW EXECUTE FUNCTION public.guard_book_print_aspect();
