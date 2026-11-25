import { createSupabaseEntity } from '../lib/supabaseEntity';
import { createSecureEntity } from '../lib/secureEntity';
import { supabase } from '../lib/supabaseClient';
import { Book } from './Book';
import { User } from './User';

export const Page = createSecureEntity(createSupabaseEntity('pages'));

/** Save only when the owner and the exact server text still match. */
export async function savePageText({ pageId, bookId, ownerId, expectedText, text }) {
  const user = await User.me();
  if (!ownerId || user?.id !== ownerId) throw new Error('Authentication required');

  const book = await Book.get(bookId);
  if (book?.id !== bookId || book.created_by !== ownerId) throw new Error('Book unavailable');

  const update = supabase.from('pages').update({ text_content: text })
    .eq('id', pageId).eq('book_id', bookId).eq('created_by', ownerId);
  const guarded = expectedText === null
    ? update.is('text_content', null)
    : update.eq('text_content', expectedText);
  const { data, error } = await guarded.select('id, text_content').maybeSingle();
  if (error) throw new Error('Page text save failed');
  return data;
}
