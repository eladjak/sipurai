import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { Zip, ZipPassThrough, strToU8 } from 'fflate';

/** Hash while consuming bounded chunks. A failed check never commits the download. */
export async function* checkedChunks(response, expected, signal) {
  if (!response.body || !/^[a-f0-9]{64}$/.test(expected)) throw new Error('Missing PDF digest');
  const reader = response.body.getReader();
  const hash = sha256.create();
  try {
    for (;;) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
      yield value;
    }
    if (bytesToHex(hash.digest()) !== expected) throw new Error('PDF did not match its proof');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
    hash.destroy();
  }
}

export async function* printArchive(files, open, receipt, signal) {
  const available = [];
  let error;
  const zip = new Zip((err, bytes) => {
    if (err) error = err;
    else if (bytes.length) available.push(bytes);
  });
  function* drain() {
    if (error) throw error;
    while (available.length) yield available.shift();
  }
  try {
    for (const file of files) {
      const entry = new ZipPassThrough(file);
      zip.add(entry);
      for await (const bytes of open(file)) {
        signal.throwIfAborted();
        entry.push(bytes);
        yield* drain();
      }
      entry.push(new Uint8Array(0), true);
      yield* drain();
    }
    const metadata = new ZipPassThrough('proof.json');
    zip.add(metadata);
    metadata.push(strToU8(JSON.stringify(receipt, null, 2)), true);
    zip.end();
    yield* drain();
  } finally {
    zip.terminate();
  }
}

// Open the native picker during the original click. Safari and mobile browsers
// without a save picker spool the ReadableStream into a browser-managed Blob.
export function chooseProofFile(name) {
  /** @type {Window & {showSaveFilePicker?: (options: object) => Promise<any>}} */
  const browser = window;
  if (typeof browser.showSaveFilePicker !== 'function') return Promise.resolve(null);
  return browser.showSaveFilePicker({ suggestedName: name, id: 'sipurai-print-proof' });
}

export async function saveProofStream(filename, chunks, handle, verify, signal) {
  const destination = handle ? await handle.createWritable() : null;
  try {
    if (destination) {
      for await (const chunk of chunks) {
        signal.throwIfAborted();
        await destination.write(chunk);
      }
      await verify();
      signal.throwIfAborted();
      await destination.close();
      return;
    }
    const stream = new ReadableStream({
      async pull(controller) {
        try {
          signal.throwIfAborted();
          const { done, value } = await chunks.next();
          if (done) controller.close();
          else controller.enqueue(value);
        } catch (error) { controller.error(error); }
      },
      async cancel() { await chunks.return?.(); },
    });
    const type = filename.endsWith('.zip') ? 'application/zip' : 'application/pdf';
    const blob = await new Response(stream, { headers: { 'Content-Type': type } }).blob();
    await verify();
    signal.throwIfAborted();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    if (destination) await destination.abort().catch(() => {});
    throw error;
  }
}
