import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { MAX_INPUT_BYTES, QualityInputError } from './daily-quality.mjs';
import { createCorrectiveWork } from './corrective-work.mjs';

const fail = (code, status = 1) => { process.stderr.write(JSON.stringify({ error: code }) + '\n'); process.exitCode = status; };
async function boundedFile(path, limit) {
  const f = await open(path, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const st = await f.stat();
    if (!st.isFile() || st.size > limit) throw new Error('invalid_file');
    const buffer = Buffer.alloc(limit + 1);
    let n = 0;
    while (n < buffer.length) {
      const result = await f.read(buffer, n, buffer.length - n);
      if (!result.bytesRead) break;
      n += result.bytesRead;
    }
    if (n > limit) throw new Error('invalid_file');
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, n));
  } finally { await f.close(); }
}
async function enabled(path) {
  if (process.env.SIPURAI_QUALITY_WORK_ENABLED !== 'true' || !path) return false;
  try { return (await boundedFile(path, 8)) === 'enabled\n'; } catch { return false; }
}
const [fixture, gate] = process.argv.slice(2);
try {
  if (!(await enabled(gate))) fail('disabled', 2);
  else if (process.argv.length !== 4) fail('arguments_required');
  else {
    const raw = await boundedFile(fixture, MAX_INPUT_BYTES);
    let input;
    try { input = JSON.parse(raw); } catch { throw new QualityInputError('invalid_json'); }
    const output = createCorrectiveWork(input);
    if (!(await enabled(gate))) fail('disabled', 2);
    else process.stdout.write(JSON.stringify(output) + '\n');
  }
} catch (error) { fail(error instanceof QualityInputError ? error.message : 'input_unavailable'); }
