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
 * Alternatively finished PDFs may be placed by the service role in bucket PRINT_READY_BUCKET (default "print-ready"):
 *   <bookId>/interior.pdf and <bookId>/cover.pdf, which are used as they are.
 *
 * INPUT IS NEVER A URL. Every object path is built here from the book id (checked to be a plain id) and read from OUR
 * Storage with the service role; nothing taken from the client or from a table column is ever fetched. Every object is
 * size-capped before it is read, and artwork must really be PNG or JPEG.
 */
export const READY_BUCKET = 'print-ready';
export const MAX_ART_BYTES = 40 * 1024 * 1024; // one page; measured ~5.7 MB
export const MAX_READY_INTERIOR_BYTES = 250 * 1024 * 1024;
export const MAX_READY_COVER_BYTES = 60 * 1024 * 1024;
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const isImage = (u8) =>
  (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4e && u8[3] === 0x47) || (u8[0] === 0xff && u8[1] === 0xd8 && u8[2] === 0xff);

export const ARTWORK_BUCKET = 'print-artwork';
const pad = (n) => String(n).padStart(2, '0');

export function createSupabaseArtworkStorage(db) {
  return {
    /** null when the object does not exist; throws when it is larger than maxBytes (checked before it is read). */
    async download(bucket, path, maxBytes) {
      const { data, error } = await db.storage.from(bucket).download(path);
      if (error || !data) return null;
      if (typeof data.size === 'number' && data.size > maxBytes) throw new Error(`stored file is too large: ${path}`);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}

async function firstOf(storage, bucket, stem) {
  for (const ext of ['png', 'jpg', 'jpeg']) {
    const bytes = await storage.download(bucket, `${stem}.${ext}`, MAX_ART_BYTES);
    if (bytes && bytes.length) {
      if (bytes.length > MAX_ART_BYTES) throw new Error(`artwork too large: ${stem}`);
      if (!isImage(bytes)) throw new Error(`artwork is not a PNG or JPEG: ${stem}`);
      return bytes;
    }
  }
  return null;
}

const isPdf = (u8) => u8 && u8.length > 1024 && String.fromCharCode(u8[0], u8[1], u8[2], u8[3]) === '%PDF';

export function createPrintFilesProvider({ storage, env = {}, build, log = console.error } = {}) {
  const bucket = env.PRINT_ARTWORK_BUCKET || ARTWORK_BUCKET;
  const builder = build || (async (...a) => (await import('../../../src/utils/printExporter.js')).buildPrintPackage(...a));

  return {
    async getPrintFiles(order, book) {
      if (!SAFE_ID.test(String(book?.id ?? ''))) throw new Error('unsafe book id');

      const readyBucket = env.PRINT_READY_BUCKET || READY_BUCKET;
      const ready = await storage.download(readyBucket, `${book.id}/interior.pdf`, MAX_READY_INTERIOR_BYTES);
      const readyCover = ready ? await storage.download(readyBucket, `${book.id}/cover.pdf`, MAX_READY_COVER_BYTES) : null;
      if (ready && readyCover) return { content: ready, cover: readyCover, meta: { prebuilt: true } };

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
