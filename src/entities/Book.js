import { createSupabaseEntity } from '../lib/supabaseEntity';
import { createSecureEntity } from '../lib/secureEntity';
import { generationStore } from '../lib/generationStore';
import { supabase } from '../lib/supabaseClient';

export const Book = { generationStore, ...createSecureEntity(
  createSupabaseEntity('books', {
    columnMap: {
      childNames: 'child_names',
      selectedCharacters: 'selected_characters',
      printEdition: 'print_edition',
    },
  })
) };

/** Compare revisions in the write so parallel edits cannot silently overwrite each other. */
export async function savePrintEdition(id, ownerId, edition) {
  const next = { ...edition, revision: edition.revision + 1 };
  const ownerUpdate = supabase.from('books').update({ print_edition: next })
    .eq('id', id).eq('created_by', ownerId);
  const guarded = edition.revision === 0
    ? ownerUpdate.or('print_edition.is.null,print_edition->>revision.eq.0')
    : ownerUpdate.filter('print_edition->>revision', 'eq', edition.revision);
  const { data, error } = await guarded.select('id').maybeSingle();
  if (error) throw new Error('save');
  if (!data) throw new Error('conflict');
  return next;
}
