import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { readablePages } from '@/lib/bookProgress';
import { supabase } from '@/lib/supabaseClient';

const storyFields = [
  'description', 'moral', 'art_style', 'length', 'genre', 'age_range', 'language',
  'child_name', 'child_age', 'child_gender', 'tone', 'interests', 'family_members',
  'childNames', 'selectedCharacters', 'cover_image',
];

export async function copyBook({ source, ownerId, title, isCurrent, resume, onPlan }) {
  if (!isCurrent() || source.created_by !== ownerId) return null;

  let copy = resume?.copy;
  let pageIds = resume?.pageIds;
  if (!resume) {
    try {
      const found = await Page.filter({ book_id: source.id, created_by: ownerId });
      if (!Array.isArray(found)) return { kind: 'readError' };
      pageIds = readablePages(found).map(page => page.id);
      if (pageIds.some(id => typeof id !== 'string' || !id)) return { kind: 'readError' };
    } catch {
      return { kind: 'readError' };
    }
    if (!isCurrent()) return null;

    try {
      const fields = Object.fromEntries(storyFields.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));
      copy = await Book.create({
        ...fields,
        title,
        created_by: ownerId,
        is_public: false,
        status: 'draft',
        total_pages: pageIds.length,
      });
    } catch {
      return { kind: 'createError' };
    }
    if (!copy?.id || copy.id === source.id || copy.created_by !== ownerId || copy.is_public !== false) {
      return { kind: 'createError' };
    }
  }

  // Keep the validated target even if the owner changed while creation was pending.
  onPlan?.({ copy, pageIds });
  if (!isCurrent()) return null;
  if (!pageIds.length) return { kind: 'emptyDraft', copy };

  try {
    const { data, error } = await supabase.rpc('sipurai_finalize_library_copy', {
      p_source: source.id,
      p_target: copy.id,
      p_source_page_ids: pageIds,
    });
    if (error?.message === 'library_copy_conflict') return { kind: 'resumeConflict', copy };
    if (!isCurrent()) return null;
    const result = Array.isArray(data) && data.length === 1 ? data[0] : null;
    if (!error && result?.copied_count === pageIds.length &&
        Number.isInteger(result.inserted_count) && result.inserted_count >= 0 && result.inserted_count <= result.copied_count) {
      return { kind: 'complete', copy, count: result.copied_count };
    }
  } catch {
    // Retry sends the same target and page IDs so a lost response cannot create another copy.
  }
  return isCurrent() ? { kind: 'interrupted', copy, pageIds } : null;
}
