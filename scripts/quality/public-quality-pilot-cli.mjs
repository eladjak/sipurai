import { link, open, stat, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { runPublicQualityPilot } from './public-quality-pilot.mjs';

const enabled = () => process.env.SIPURAI_QUALITY_DAILY_ENABLED === 'true';
const directory = process.env.STATE_DIRECTORY;
const writeLimit = 8192;

async function reserve(day) {
  if (!enabled()) return false;
  try {
    const marker = await open(join(directory, `${day}.claim`), 'wx', 0o600);
    await marker.close();
    return true;
  } catch (error) {
    if (error.code === 'EEXIST') return false;
    throw error;
  }
}

async function publish(day, snapshot) {
  if (!enabled()) return false;
  const bytes = JSON.stringify(snapshot) + '\n';
  if (Buffer.byteLength(bytes) > writeLimit) throw new Error('output_budget');
  const staged = join(directory, `${day}.snapshot.part`);
  const ready = join(directory, `${day}.json`);
  const handle = await open(staged, 'wx', 0o600);
  try {
    try {
      if (!enabled()) return false;
      await handle.writeFile(bytes, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    if (!enabled()) return false;
    await link(staged, ready);
    return true;
  } finally {
    await unlink(staged);
  }
}

function diagnostic(outcome, status) {
  process.stderr.write(JSON.stringify({ outcome }) + '\n');
  process.exitCode = status;
}

if (!enabled()) diagnostic('disabled', 2);
else if (process.argv.length !== 2 || !directory || !isAbsolute(directory)) diagnostic('invalid_configuration', 1);
else {
  try {
    const state = await stat(directory);
    if (!state.isDirectory() || (state.mode & 0o077) !== 0 || state.uid !== process.getuid()) {
      diagnostic('invalid_state_permissions', 1);
    } else {
      const outcome = await runPublicQualityPilot({ enabled, reserve, publish });
      diagnostic(outcome, outcome === 'disabled' ? 2 : 0);
    }
  } catch {
    diagnostic('pilot_failed', 1);
  }
}
