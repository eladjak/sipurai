import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryQuotaStore, reserveBook, checkCall, israelParts, resetInfo, gateAiCall } from '../api/_lib/quota.js';
import reserveHandler from '../api/books/reserve.js';

const NOV = new Date('2026-11-09T12:00:00Z');
const env = {};
const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const call = (store, userId, bookKey, over = {}) => reserveBook({ store, userId, bookKey, env, now: NOV, ...over });

test('five books pass, the 6th in the same month is refused with date + upgrade', async () => {
  const store = createMemoryQuotaStore();
  for (let i = 1; i <= 5; i++) assert.equal((await call(store, 'u1', `book-key-${i}0000`)).http, 200);
  const r6 = await call(store, 'u1', 'book-key-60000');
  assert.equal(r6.http, 429);
  assert.equal(r6.body.error.code, 'monthly_limit');
  assert.ok(r6.body.error.message_he.includes('1 בדצמבר'));
  assert.equal(r6.body.error.canUpgrade, true);
});

test('the same book key is idempotent: a retry never costs a second slot', async () => {
  const store = createMemoryQuotaStore();
  for (let i = 0; i < 4; i++) await call(store, 'u1', 'same-book-key');
  assert.equal((await store.status({ userId: 'u1', monthKey: '2026-11' })).used, 1);
});

test('parallel requests cannot exceed 5', async () => {
  const store = createMemoryQuotaStore();
  const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => call(store, 'u1', `par-key-${String(i).padStart(4, '0')}`)));
  assert.equal(rs.filter((r) => r.http === 200).length, 5);
  assert.equal(rs.filter((r) => r.http === 429).length, 15);
});

test('users are independent', async () => {
  const store = createMemoryQuotaStore();
  for (let i = 0; i < 5; i++) await call(store, 'u1', `a-book-key-${i}0`);
  assert.equal((await call(store, 'u2', 'b-book-key-00')).http, 200);
});

test('paid users are unaffected by the monthly limit', async () => {
  const store = createMemoryQuotaStore({ paid: ['pay'] });
  for (let i = 0; i < 9; i++) assert.equal((await call(store, 'pay', `paid-key-${i}0000`, { env: { SIPURAI_DAILY_BOOK_CAP: '50' } })).http, 200);
});

test('month rolls over at Israel midnight, not UTC midnight', async () => {
  const store = createMemoryQuotaStore();
  const lastNight = new Date('2026-11-30T21:30:00Z'); // 23:30 Israel, 30 Nov
  for (let i = 0; i < 5; i++) await call(store, 'u1', `nov-key-${i}0000`, { now: lastNight });
  assert.equal((await call(store, 'u1', 'nov-key-60000', { now: lastNight })).http, 429);
  const afterMidnight = new Date('2026-11-30T22:30:00Z'); // 00:30 Israel, 1 Dec (still 30 Nov in UTC)
  assert.equal(israelParts(afterMidnight).monthKey, '2026-12');
  assert.equal(israelParts(lastNight).monthKey, '2026-11');
  assert.equal((await call(store, 'u1', 'dec-key-00000', { now: afterMidnight })).http, 200);
  assert.equal(resetInfo(new Date('2026-12-15T10:00:00Z')).resetsOn, '2027-01-01');
});

test('global daily cap stops new books, alerts Elad once, never customers', async () => {
  const store = createMemoryQuotaStore();
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return { ok: true }; };
  const e = { SIPURAI_DAILY_BOOK_CAP: '3', QUOTA_ALERT_WEBHOOK_URL: 'https://alerts.example/elad' };
  for (let i = 0; i < 3; i++) assert.equal((await call(store, `u${i}`, `cap-key-${i}0000`, { env: e, fetchImpl })).http, 200);
  const r = await call(store, 'u9', 'cap-key-90000', { env: e, fetchImpl });
  assert.equal(r.http, 503);
  assert.equal(r.body.error.code, 'daily_cap');
  assert.ok(!JSON.stringify(r.body).includes('alerts.example'));
  await call(store, 'u8', 'cap-key-80000', { env: e, fetchImpl });
  assert.equal(sent.length, 1, 'alert sent once per day');
  assert.equal(sent[0].url, 'https://alerts.example/elad');
  // next Israel day resets the counter
  assert.equal((await call(store, 'u9', 'cap-key-91111', { env: e, fetchImpl, now: new Date('2026-11-10T12:00:00Z') })).http, 200);
});

test('a refused book does not consume the daily cap', async () => {
  const store = createMemoryQuotaStore();
  const e = { SIPURAI_DAILY_BOOK_CAP: '6' };
  for (let i = 0; i < 5; i++) await call(store, 'u1', `x-key-${i}00000`, { env: e });
  for (let i = 0; i < 5; i++) await call(store, 'u1', `refused-${i}00000`, { env: e });
  assert.equal((await call(store, 'u2', 'other-key-0000', { env: e })).http, 200);
});

test('per-book call ceiling and loose allowance bound direct API use', async () => {
  const store = createMemoryQuotaStore();
  const e = { SIPURAI_CALLS_PER_BOOK: '3', SIPURAI_LOOSE_CALLS_PER_DAY: '2' };
  await call(store, 'u1', 'book-with-calls');
  for (let i = 0; i < 3; i++) assert.equal((await checkCall({ store, userId: 'u1', bookKey: 'book-with-calls', env: e, now: NOV })).ok, true);
  assert.equal((await checkCall({ store, userId: 'u1', bookKey: 'book-with-calls', env: e, now: NOV })).code, 'book_call_cap');
  assert.equal((await checkCall({ store, userId: 'u2', bookKey: '', env: e, now: NOV })).ok, true);
  assert.equal((await checkCall({ store, userId: 'u2', bookKey: 'never-reserved', env: e, now: NOV })).ok, true);
  assert.equal((await checkCall({ store, userId: 'u2', bookKey: '', env: e, now: NOV })).code, 'loose_cap');
});

test('gate: off by default, on = blocks, store failure = fails CLOSED', async () => {
  const store = createMemoryQuotaStore();
  const req = { headers: {} };
  let res = mkRes();
  assert.equal(await gateAiCall(req, res, 'u1', { env: {}, store }), false);
  const on = { FREE_QUOTA_ENFORCE: 'true', SIPURAI_LOOSE_CALLS_PER_DAY: '1' };
  assert.equal(await gateAiCall(req, mkRes(), 'u1', { env: on, store }), false);
  res = mkRes();
  assert.equal(await gateAiCall(req, res, 'u1', { env: on, store }), true);
  assert.equal(res.code, 429);
  res = mkRes();
  const broken = { useCall: async () => { throw new Error('db down'); } };
  assert.equal(await gateAiCall(req, res, 'u1', { env: on, store: broken }), true);
  assert.equal(res.code, 503);
});

test('HTTP: 401 without auth, 400 on bad key, 200 x5 then 429, store error = 503', async () => {
  const store = createMemoryQuotaStore();
  const auth = async () => ({ ok: true, payload: { sub: 'user_http' } });
  const post = async (body, over) => {
    const res = mkRes();
    await reserveHandler({ method: 'POST', headers: {}, body }, res, { env, store, now: NOV, auth, ...over });
    return res;
  };
  assert.equal((await post({ bookKey: 'abcdefgh1' }, { auth: async () => ({ ok: false }) })).code, 401);
  assert.equal((await post({ bookKey: '../x' })).code, 400);
  for (let i = 0; i < 5; i++) assert.equal((await post({ bookKey: `http-key-${i}0000` })).code, 200);
  const six = await post({ bookKey: 'http-key-60000' });
  assert.equal(six.code, 429);
  assert.ok(six.body.error.message_he.includes('1 בדצמבר'));
  assert.equal((await post({ bookKey: 'http-key-70000' }, { store: { reserve: async () => { throw new Error('x'); } } })).code, 503);
});
