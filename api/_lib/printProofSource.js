import { ProofError, hash } from './printProofRequest.js';

export function createPrintProofStore(db) {
  return {
    async findBook(bookId, { withSource } = {}) {
      const fields = withSource
        ? 'id,created_by,title,language,print_size,total_pages,cover_image,print_revision:print_edition->revision'
        : 'id,created_by';
      const { data, error } = await db.from('books').select(fields).eq('id', bookId).maybeSingle();
      if (error) throw new ProofError('proof_unavailable');
      return data;
    },
    async sourcePages(bookId) {
      const { data, count, error } = await db.from('pages')
        .select('id,page_number,text_content,image_url', { count: 'exact' }).eq('book_id', bookId)
        .order('page_number', { ascending: true }).order('id', { ascending: true });
      // An API row-limit truncation is a failed snapshot, even if the returned prefix looks valid.
      if (error || !Array.isArray(data) || data.length !== count) throw new ProofError('proof_unavailable');
      return data;
    },
  };
}

export async function sourceFingerprint(store, bookId, book, expectedRevision) {
  const revision = book.print_revision ?? 0;
  if (!Number.isSafeInteger(revision) || revision < 0) throw new ProofError('proof_unavailable');
  if (expectedRevision !== undefined && expectedRevision !== revision) throw new ProofError('proof_conflict');
  const rows = await store.sourcePages(bookId);
  // Preserve duplicate page numbers and every source row. The store applies ordered ties by row ID.
  const pages = rows.map(row => [row.id, row.page_number, row.text_content, row.image_url]);
  return hash(JSON.stringify([
    bookId, book.title, book.language, book.print_size, book.total_pages, book.cover_image, revision, pages,
  ]));
}

export function bindProofSource(request, fingerprint) {
  if (request.op !== 'prepare') return { ...request, fingerprint };
  const content = Buffer.from(JSON.stringify({ ...request.spec, sourceFingerprint: fingerprint }));
  return { op: request.op, bookId: request.bookId, content, job: hash(content) };
}
