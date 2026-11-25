import { createSupabaseEntity } from '../lib/supabaseEntity';
import { createSecureEntity } from '../lib/secureEntity';
import { supabase } from '../lib/supabaseClient';
import { User } from './User';

export const Page = createSecureEntity(createSupabaseEntity('pages'));

/** Save only when the owner and the exact server text still match. */
export async function savePageText({ pageId, bookId, ownerId, expectedText, text }) {
  const user = await User.me();
  if (!ownerId || user?.id !== ownerId) throw new Error('Authentication required');

  const { data, error } = await supabase.rpc('sipurai_save_page_text', {
    p_page_id: pageId,
    p_book_id: bookId,
    p_owner_id: ownerId,
    p_expected_text: expectedText,
    p_text: text,
  });
  if (error || !Array.isArray(data) || data.length > 1) throw new Error('Page text save failed');
  return data[0] ?? null;
}
