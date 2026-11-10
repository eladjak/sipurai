/**
 * getPrintFiles: turns the finished artwork of a book into the two print PDFs the partner needs.
 *
 *   artwork (Storage bucket PRINT_ARTWORK_BUCKET, default "print-artwork"):
 *     <bookId>/page-01.png ... page-NN.png   (NN = order.page_count; .jpg also accepted)
 *     <bookId>/front.png, <bookId>/back.png
 *   output: { content: Uint8Array, cover: Uint8Array, meta }   -- bytes, handed straight to the vendor client.
 *
 * Why bytes and not our own storage: the interior PDF is ~125-155 MB, above the default Supabase object limit
 * (50 MB). The vendor client PUTs the bytes directly to the partner's signed upload URL, in the same invocation.
 *
 * The PDFs are built by src/utils/printExporter.js (same code the unit tests measure): interior pages at
 * trim + 2 x 3.2 mm bleed (226.4 mm for 22x22), cover as ONE flat spread of 2 x trim + spine + 2 x bleed
 * (448.2 x 226.4 mm for 24 pp, spine 1.8 mm = what the partner computes). Artwork below 300 dpi is refused.
 *
 * Returns null when artwork is missing (the service records print_files_missing and alerts).
 * A book that already has finished files (columns print_content_url / print_cover_url) uses them as they are.
 */
export const ARTWORK_BUCKET = 'print-artwork';
const pad = (n) => String(n).padStart(2, '0');

export function createSupabaseArtworkStorage(db) {
  return {
    async download(bucket, path) {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

async function firstOf(storage, bucket, stem) {
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const bytes = await storage.download(bucket, `${stem}.${ext}`);
    if (bytes && bytes.length) return bytes;
  }
  return null;
}

const isPdf = (u8) => u8 && u8.length > 1024 && String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === '%PDF';

export function createPrintFilesProvider({ storage, env = {}, build, log = console.error } = {}) {
  const bucket = env.PRINT_ARTWORK_BUCKET || ARTWORK_BUCKET;
  const builder = build || (async (...a) => (await import('../../../src/utils/printExporter.js')).buildPrintPackage(...a));

  return {
    async getPrintFiles(order, book) {
      if (book?.printFiles?.contentUrl && book?.printFiles?.coverUrl) return book.printFiles;

      const n = order.page_count;
      const pages = [];
      const missing = [];
      for (let i = 1; i <= n; i += 1) {
        const bytes = await firstOf(storage, bucket, `${book.id}/page-${pad(i)}`);
        if (bytes) pages.push(bytes);
        else missing.push(`page-${pad(i)}`);
      }
      const front = await firstOf(storage, bucket, `${book.id}/front`);
      const back = await firstOf(storage, bucket, `${book.id}/back`);
      if (!front) missing.push('front');
      if (!back) missing.push('back');
      if (missing.length) {
        log(`print artwork missing for book ${book.id}: ${missing.join(',')}`);
        return null;
      }

      const spec = { presetId: order.preset_id, pageCount: n, paper: 'white-110gsm', cover: 'soft-matte' };
      const pkg = await builder(spec, { pages, front, back });
      const content = new Uint8Array(pkg.interior.output('arraybuffer'));
      const cover = new Uint8Array(pkg.cover.output('arraybuffer'));
      if (!isPdf(content) || !isPdf(cover)) throw new Error('generated print file is not a PDF');
      return { content, cover, meta: pkg.meta };
    },
  };
}
