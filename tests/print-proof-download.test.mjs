import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { unzipSync } from 'fflate';
import { checkedChunks, printArchive, saveProofStream } from '../src/lib/printEdition/proofDownload.js';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function nativeDestination() {
  const state = { parts: [], closed: false, aborted: false };
  return {
    state, createWritable: async () => ({
      write: async bytes => state.parts.push(Buffer.from(bytes)),
      close: async () => { state.closed = true; }, abort: async () => { state.aborted = true; },
    }),
  };
}

test('the stored archive contains both already-rendered PDFs and their exact hashes', async () => {
  const files = { 'interior.pdf': Buffer.from('Private interior proof'), 'cover.pdf': Buffer.from('Private cover proof') };
  const hashes = Object.fromEntries(Object.entries(files).map(([file, bytes]) => [file, digest(bytes)]));
  const signal = new AbortController().signal;
  const open = file => checkedChunks(new Response(files[file]), hashes[file], signal);
  const output = nativeDestination();
  await saveProofStream('print.zip', printArchive(Object.keys(files), open, { pdfSha256: hashes }, signal), output, async () => {}, signal);
  const contents = unzipSync(Buffer.concat(output.state.parts));
  assert.equal(output.state.closed, true);
  for (const file of Object.keys(files)) assert.equal(digest(contents[file]), hashes[file]);
  assert.deepEqual(JSON.parse(Buffer.from(contents['proof.json']).toString()).pdfSha256, hashes);
});

test('a changed edition or wrong PDF digest aborts the native file before commit', async () => {
  for (const mismatch of ['file', 'revision']) {
    const bytes = Buffer.from('proof');
    const signal = new AbortController().signal;
    const chunks = checkedChunks(new Response(bytes), mismatch === 'file' ? '0'.repeat(64) : digest(bytes), signal);
    const output = nativeDestination();
    const verify = async () => { if (mismatch === 'revision') throw new Error('conflict'); };
    await assert.rejects(saveProofStream('proof.pdf', chunks, output, verify, signal));
    assert.equal(output.state.aborted, true);
    assert.equal(output.state.closed, false);
  }
});
