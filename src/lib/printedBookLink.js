// A printed identifier is permanent. Access still follows the owner's current sharing choice.
export const isPrintBookId = (id) =>
  typeof id === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id);

export async function resolvePrintedBook(client, id, userId) {
  if (!isPrintBookId(id)) return { kind: 'private' };
  const bookId = id.toLowerCase();
  if (userId) {
    const owner = await client.from('books').select('id')
      .eq('id', bookId).eq('created_by', userId).maybeSingle();
    if (owner.error) throw new Error('Book lookup unavailable');
    if (owner.data?.id === bookId) return { kind: 'owner' };
  }
  const shared = await client.from('public_books').select('title,cover_image,description')
    .eq('id', bookId).eq('is_public', true).maybeSingle();
  if (shared.error) throw new Error('Preview unavailable');
  return shared.data ? { kind: 'shared', book: shared.data } : { kind: 'private' };
}
