#!/usr/bin/env node
/**
 * FIRST LIVE ORDER of the already-registered proof book (#33377) to the owner's own address.
 * THIS SPENDS MONEY (it deducts from the print partner deposit). It refuses to run unless the owner has
 * seen the exact total and typed it back:
 *
 *   step 1 (prices only, spends nothing):   node scripts/bookpod-first-order.mjs --address-file addr.json
 *   step 2 (after the owner approves 53.66): node scripts/bookpod-first-order.mjs --address-file addr.json --confirm-total 53.66
 *
 * addr.json: {"fullName","phone","city","street","houseNumber","zip"}  (the owner's address, same fields as checkout)
 * Env: BOOKPOD_USER_ID, BOOKPOD_API_TOKEN, BOOKPOD_CONTACT_EMAIL (sourced from the keyvault, see docs/BOOKPOD-GO-LIVE.md).
 * The same price gate as production applies: a partner price that differs from ours by more than the margin is refused.
 */
import fs from 'node:fs';
import { createVendorClient, vendorToken } from '../api/_lib/bookpod/client.js';
import { validateAddress } from '../api/_lib/orders/address.js';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const bookid = Number(arg('bookid', '33377'));
const confirm = arg('confirm-total', null);
const file = arg('address-file', null);
if (!file) { console.error('FAIL: --address-file is required'); process.exit(1); }
if (!vendorToken(process.env) || !process.env.BOOKPOD_USER_ID || !process.env.BOOKPOD_CONTACT_EMAIL) {
  console.error('FAIL: BOOKPOD_USER_ID, BOOKPOD_API_TOKEN and BOOKPOD_CONTACT_EMAIL must be in the environment');
  process.exit(1);
}
const addr = validateAddress(JSON.parse(fs.readFileSync(file, 'utf8')), 'ship');
if (!addr.ok) { console.error('FAIL: address invalid', JSON.stringify(addr.errors)); process.exit(1); }

const ref = `first-live-${new Date().toISOString().slice(0, 10)}`;
const order = {
  id: ref, preset_id: 'square-220', page_count: 24, qty: 1, method: 'ship',
  address: addr.address, quote: { presetId: 'square-220', pageCount: 24 },
};
const client = createVendorClient({ env: { ...process.env, BOOKPOD_ENABLED: 'true' } });
try {
  const q = await client.quote(order, bookid);
  const total = (q.totalAgorot / 100).toFixed(2);
  console.log(`book ${bookid}, 1 copy, shipped to the given address`);
  console.log(`EXACT TOTAL the partner will charge: ${total} ILS   (our expected ${(q.expectedAgorot / 100).toFixed(2)})`);
  if (confirm === null) { console.log('Nothing was ordered. To order, rerun with --confirm-total ' + total); process.exit(0); }
  if (confirm !== total) { console.error(`REFUSED: --confirm-total ${confirm} does not equal the live total ${total}. Nothing ordered.`); process.exit(1); }
  const out = await client.orderExistingBook(order, bookid);
  console.log(`ORDERED. partner order_no=${out.ref} reference_num1=${ref}`);
} catch (e) {
  console.error(`FAIL code=${e.code || 'error'} ${String(e.message).slice(0, 200)}${e.unknownOutcome ? '  (OUTCOME UNKNOWN: check the partner dashboard before retrying)' : ''}`);
  process.exit(1);
}
