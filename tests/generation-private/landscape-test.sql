-- Synthetic, isolated: exercise original size migration followed by landscape extension.
DO $$
DECLARE square_id uuid := '77777777-7777-4777-8777-777777777777';
        wide_id uuid := '88888888-8888-4888-8888-888888888888';
BEGIN
 INSERT INTO public.books(id,created_by,title,cover_image,print_size) VALUES
   (square_id,'owner','square','', 'square-220'),
   (wide_id,'owner','wide','', 'landscape-210x170');
 UPDATE public.books SET print_size='square-200' WHERE id=square_id;
 UPDATE public.books SET print_size='square-220' WHERE id=wide_id;
 UPDATE public.books SET print_size='landscape-210x170' WHERE id=wide_id;
 UPDATE public.books SET cover_image='synthetic' WHERE id=wide_id;
 BEGIN
   UPDATE public.books SET print_size='portrait-165x235' WHERE id=wide_id;
   RAISE EXCEPTION 'illustrated landscape aspect unexpectedly changed';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Cannot change book aspect after illustrations exist' THEN RAISE; END IF;
 END;
 INSERT INTO public.pages(book_id,created_by,page_number,image_url) VALUES(square_id,'owner',0,'synthetic');
 BEGIN
   UPDATE public.books SET print_size='landscape-210x170' WHERE id=square_id;
   RAISE EXCEPTION 'illustrated square aspect unexpectedly changed';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Cannot change book aspect after illustrations exist' THEN RAISE; END IF;
 END;
 BEGIN
   UPDATE public.books SET print_size='invalid-size' WHERE id=square_id;
   RAISE EXCEPTION 'invalid size accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
