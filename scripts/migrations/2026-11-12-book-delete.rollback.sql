-- Rolls back 2026-11-12-book-delete.sql. After this, api/_lib/bookControls.js (RPC version) cannot delete books.
drop function if exists public.sipurai_delete_book(uuid, text);
drop function if exists public.sipurai_image_path(text);
