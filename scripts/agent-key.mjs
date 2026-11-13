#!/usr/bin/env node
/**
 * Create / rotate / revoke the "סוכן" key for Sipurai admin endpoints.
 *   node scripts/agent-key.mjs generate --out <vault.env> --hash-out <hash.txt> [--base-url URL]
 *     - raw key (sagent_<64 hex>) -> ONLY the --out file (mode 600, refuses to overwrite), never printed
 *     - sha256 hex of it         -> --hash-out file (mode 600): this is what goes into Vercel env
 *                                   SIPURAI_AGENT_KEY_SHA256 (set by Elad in go-live; the raw key never leaves the vault)
 *   revoke : remove (or blank) SIPURAI_AGENT_KEY_SHA256 in Vercel and redeploy -> instant 401. No DB row to delete.
 *   rotate : generate a new pair, replace the env hash, delete the old vault file.
 */
import { createHash, randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const a = process.argv.slice(2);
const f = (n) => { const i = a.indexOf(n); return i === -1 ? null : a[i + 1] ?? null; };
if (a[0] !== 'generate' || !f('--out') || !f('--hash-out')) {
  console.error('Usage: node scripts/agent-key.mjs generate --out <vault.env> --hash-out <hash.txt> [--base-url URL]');
  process.exit(1);
}
const raw = `sagent_${randomBytes(32).toString('hex')}`;
const hash = createHash('sha256').update(raw, 'utf8').digest('hex');
try {
  writeFileSync(f('--out'), `SIPURAI_AGENT_KEY=${raw}\nSIPURAI_BASE_URL=${f('--base-url') ?? 'https://www.sipurai.ai'}\n`, { mode: 0o600, flag: 'wx' });
  writeFileSync(f('--hash-out'), `${hash}\n`, { mode: 0o600, flag: 'wx' });
} catch (e) {
  console.error(`Could not write output (${e.code ?? 'error'}). Nothing generated.`);
  process.exit(1);
}
console.log('Key and hash written (mode 600), not printed. Put the hash in Vercel env SIPURAI_AGENT_KEY_SHA256.');
