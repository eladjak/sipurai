#!/usr/bin/env node
/**
 * Live smoke test for the print partner API: ONE read-only call, POST /api/v1/orders/price.
 * It creates nothing, uploads nothing, orders nothing and costs nothing.
 *
 *   set -a; . /etc/elad-network/keyvault/bookpod-sipurai.env; set +a   # BOOKPOD_USER_ID + BOOKPOD_API_TOKEN
 *   BOOKPOD_CONTACT_EMAIL=you@example.com node scripts/bookpod-smoke.mjs --bookid 33377 --method ship
 *
 * Flags: --bookid <id> (default 33377)  --qty <n> (default 1)  --method ship|pickup (default ship)
 * Prints: HTTP result class, partner total, OUR expected total, margin, verdict. Never prints the token.
 * Exit 0 = authenticated AND price within margin. Exit 1 = anything else (read the verdict line).
 */
import { createVendorClient, vendorToken, DEFAULT_API_BASE } from '../api/_lib/bookpod/client.js';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : dflt;
};
const bookid = Number(arg('bookid', '33377'));
const qty = Number(arg('qty', '1'));
const method = arg('method', 'ship');

const env = {
  ...process.env,
  BOOKPOD_ENABLED: 'true', // this script is an explicit, read-only live call; it does not touch any Vercel flag
  BOOKPOD_CONTACT_EMAIL: process.env.BOOKPOD_CONTACT_EMAIL || 'smoke@invalid.example',
};
if (!vendorToken(env) || !env.BOOKPOD_USER_ID) {
  console.error('FAIL: BOOKPOD_USER_ID and BOOKPOD_API_TOKEN must be in the environment (see header of this file).');
  process.exit(1);
}

// A dummy address: the price endpoint only needs a destination to quote shipping. Nothing is created.
const order = {
  id: '00000000-0000-4000-8000-000000000000',
  preset_id: 'square-220',
  page_count: 24,
  qty,
  method,
  address: { fullName: 'Price Check', phone: '050-0000000', city: 'Tel Aviv', street: 'Ben Yehuda', houseNumber: '12', zip: '6100000' },
  quote: { presetId: 'square-220', pageCount: 24 },
};

console.log(`target: ${env.BOOKPOD_API_BASE || DEFAULT_API_BASE}  call: POST /api/v1/orders/price  bookid=${bookid} qty=${qty} method=${method}`);
try {
  const q = await createVendorClient({ env }).quote(order, bookid);
  const diff = q.totalAgorot - q.expectedAgorot;
  const margin = Number(env.BOOKPOD_PRICE_MARGIN_AGOROT ?? 200);
  console.log(`partner total : ${(q.totalAgorot / 100).toFixed(2)} ILS`);
  console.log(`our expected  : ${(q.expectedAgorot / 100).toFixed(2)} ILS   (margin ${(margin / 100).toFixed(2)})`);
  console.log(`priceable=${q.raw.priceable} shipping=${JSON.stringify(q.raw.shipping)} itemsSubtotal=${q.raw.itemsSubtotal}`);
  const ok = Math.abs(diff) <= margin;
  console.log(ok ? 'VERDICT: OK - authenticated, price within margin' : `VERDICT: PRICE GAP ${(diff / 100).toFixed(2)} ILS - orders would be refused; decide before go-live`);
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log(`VERDICT: FAIL code=${e.code || 'error'} ${String(e.message).slice(0, 200)}`);
  process.exit(1);
}
