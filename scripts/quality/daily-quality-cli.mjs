import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createDailyQualitySnapshot, MAX_INPUT_BYTES, QualityInputError } from './daily-quality.mjs';

const enabled = () => process.env.SIPURAI_QUALITY_DAILY_ENABLED === 'true';
const fail = (code, status = 1) => {
  process.stderr.write(JSON.stringify({ error: code }) + '\n');
  process.exitCode = status;
};

async function readFixture(path) {
  const handle = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new QualityInputError('fixture_not_regular');
    if (info.size > MAX_INPUT_BYTES) throw new QualityInputError('byte_budget');
    const bytes = Buffer.alloc(MAX_INPUT_BYTES + 1);
    let cursor = 0;
    while (cursor < bytes.length) {
      const { bytesRead } = await handle.read(bytes, cursor, bytes.length - cursor);
      if (bytesRead === 0) break;
      cursor += bytesRead;
    }
    if (cursor > MAX_INPUT_BYTES) throw new QualityInputError('byte_budget');
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, cursor)));
    } catch {
      throw new QualityInputError('invalid_json');
    }
  } finally {
    await handle.close();
  }
}

if (!enabled()) {
  fail('disabled', 2);
} else if (process.argv.length !== 3) {
  fail('fixture_required');
} else {
  try {
    const snapshot = createDailyQualitySnapshot(await readFixture(process.argv[2]));
    if (!enabled()) fail('disabled', 2);
    else process.stdout.write(JSON.stringify(snapshot) + '\n');
  } catch (error) {
    fail(error instanceof QualityInputError ? error.message : 'fixture_unavailable');
  }
}
