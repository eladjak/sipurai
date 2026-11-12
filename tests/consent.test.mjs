import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryConsentStore, requireConsent, recordConsent, hasConsent, validateAcceptance, previousVersionStillAccepted } from '../api/_lib/consent.js';
import { CURRENT_POLICY_VERSION, PREVIOUS_POLICY_VERSION, PREVIOUS_VERSION_ACCEPTED_UNTIL, CONSENT_ITEMS } from '../api/_lib/policyVersion.js';
import consentHandler from '../api/privacy/consent.js';
import generateHandler from '../api/ai/generate.js';
import ttsHandler from '../api/ai/tts.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const asUser = (sub) => async () => ({ ok: true, payload: { sub } });
const noUser = async () => ({ ok: false, reason: 'no bearer token' });
const goodBody = { policyVersion: CURRENT_POLICY_VERSION, items: { guardian_18: true, privacy_children_abroad: true, terms: true }, locale: 'he' };
const accept = (store, userId) => recordConsent({ store, userId, body: goodBody, userAgent: 'test-agent' });

test('no consent record -> 403 with a clear code, before anything else runs', async () => {
  const res = mkRes();
  const stopped = await requireConsent({}, res, 'user_A', { consentStore: createMemoryConsentStore() });
  assert.equal(stopped, true);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'consent_required');
  assert.match(res.body.error, /מדיניות הפרטיות/);
});

test('after the parent accepts, the same user passes and another user still does not', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_A');
  const a = mkRes();
  assert.equal(await requireConsent({}, a, 'user_A', { consentStore: store }), false);
  assert.equal(a.code, 200);
  const b = mkRes();
  assert.equal(await requireConsent({}, b, 'user_B', { consentStore: store }), true);
  assert.equal(b.code, 403);
});

test('a version that is neither current nor the graced previous one asks again', async () => {
  const store = createMemoryConsentStore();
  await store.save({ userId: 'user_A', policyVersion: '2025-01-01', items: {}, locale: 'he', userAgent: null });
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: store }), true);
  assert.equal(res.code, 403);
});

test('a store that cannot answer fails CLOSED (503), never open', async () => {
  const broken = { has: async () => { throw new Error('db down'); } };
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: broken }), true);
  assert.equal(res.code, 503);
  assert.equal(res.body.code, 'consent_unavailable');
});

test('acceptance needs the exact current version and ALL THREE boxes', () => {
  assert.equal(validateAcceptance({ ...goodBody, policyVersion: 'old' }).code, 'stale_version');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true } }).code, 'items_missing');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true, privacy_children_abroad: true } }).code, 'items_missing');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true, privacy_children_abroad: true, terms: 'yes' } }).code, 'items_missing');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true, policy_and_terms: true } }).code, 'items_missing');
  assert.deepEqual(CONSENT_ITEMS, ['guardian_18', 'privacy_children_abroad', 'terms']);
  assert.equal(validateAcceptance({ policyVersion: CURRENT_POLICY_VERSION }).code, 'items_missing');
  const ok = validateAcceptance({ ...goodBody, locale: 'xx' });
  assert.equal(ok.ok, true);
  assert.equal(ok.locale, null);
});

test('stored record carries version, items, locale and a truncated user agent', async () => {
  const store = createMemoryConsentStore();
  const r = await recordConsent({ store, userId: 'user_A', body: goodBody, userAgent: 'x'.repeat(500) });
  assert.equal(r.http, 200);
  const row = store._rows[0];
  assert.equal(row.policy_version, CURRENT_POLICY_VERSION);
  assert.deepEqual(row.items, { guardian_18: true, privacy_children_abroad: true, terms: true });
  assert.equal(row.locale, 'he');
  assert.equal(row.user_agent.length, 300);
  // accepting twice stays one row
  await accept(store, 'user_A');
  assert.equal(store._rows.length, 1);
});

test('consent endpoint: needs login; user comes from the token, never from the body', async () => {
  const store = createMemoryConsentStore();
  const anon = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, anon, { auth: noUser, consentStore: store });
  assert.equal(anon.code, 401);

  // user A posts a body that tries to name user B
  const post = mkRes();
  await consentHandler({ method: 'POST', headers: { 'user-agent': 'ua' }, body: { ...goodBody, userId: 'user_B', user_id: 'user_B' } }, post, { auth: asUser('user_A'), consentStore: store });
  assert.equal(post.code, 200);
  assert.equal(await hasConsent({ store, userId: 'user_A' }), true);
  assert.equal(await hasConsent({ store, userId: 'user_B' }), false);

  const getB = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, getB, { auth: asUser('user_B'), consentStore: store });
  assert.equal(getB.body.hasConsent, false);
  const getA = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, getA, { auth: asUser('user_A'), consentStore: store });
  assert.equal(getA.body.hasConsent, true);
});

test('AI routes: generate and tts answer 403 consent_required when the parent has not accepted', async () => {
  for (const [name, handler] of [['generate', generateHandler], ['tts', ttsHandler]]) {
    const store = createMemoryConsentStore();
    const res = mkRes();
    await handler({ method: 'POST', headers: {}, body: { prompt: 'שלום', type: 'text', text: 'שלום', provider: 'openai' } }, res, { auth: asUser('user_A'), consentStore: store });
    assert.equal(res.code, 403, `${name} should refuse without consent`);
    assert.equal(res.body.code, 'consent_required', name);
  }
});

test('AI routes: with consent the request goes past the privacy gate', async () => {
  for (const [name, handler] of [['generate', generateHandler], ['tts', ttsHandler]]) {
    const store = createMemoryConsentStore();
    await accept(store, 'user_A');
    const res = mkRes();
    await handler({ method: 'POST', headers: {}, body: {} }, res, { auth: asUser('user_A'), consentStore: store });
    assert.ok(![401, 403, 503].includes(res.code), `${name} got ${res.code}; it should be past the gate (400/500 from later checks)`);
    assert.notEqual(res.body?.code, 'consent_required', name);
  }
});

test('AI routes: another user\'s consent does not open the gate for this user', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_B');
  const res = mkRes();
  await generateHandler({ method: 'POST', headers: {}, body: { prompt: 'x', type: 'text' } }, res, { auth: asUser('user_A'), consentStore: store });
  assert.equal(res.code, 403);
});

test('NO CACHE: consent removed after a successful call -> the very next call is 403', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_A');
  const first = mkRes();
  assert.equal(await requireConsent({}, first, 'user_A', { consentStore: store }), false);
  await store.deleteAll('user_A'); // e.g. another serverless instance removed the record
  const second = mkRes();
  assert.equal(await requireConsent({}, second, 'user_A', { consentStore: store }), true);
  assert.equal(second.code, 403);
});

test('NO CACHE: a database outage right after a successful call is 503, not "let through"', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_A');
  assert.equal(await requireConsent({}, mkRes(), 'user_A', { consentStore: store }), false);
  const down = { has: async () => { throw new Error('db down'); } };
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: down }), true);
  assert.equal(res.code, 503);
});

test('a user whose account is being deleted cannot record a new acceptance', async () => {
  const store = createMemoryConsentStore();
  store._deleting.add('user_A');
  const r = await recordConsent({ store, userId: 'user_A', body: goodBody, userAgent: 'x' });
  assert.equal(r.http, 409);
  assert.equal(r.body.error.code, 'account_deleting');
  assert.equal(store._rows.length, 0);
});

import reserveHandler from '../api/books/reserve.js';
import { endpoint } from '../api/_lib/orders/handlers.js';

test('item 8: books/reserve refuses (403) a parent who has not accepted, and passes one who has', async () => {
  const store = createMemoryConsentStore();
  const res = mkRes();
  await reserveHandler({ method: 'POST', headers: {}, body: { bookKey: 'abcdefgh1234' } }, res, { auth: asUser('user_A'), consentStore: store, env: {} });
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'consent_required');
  await accept(store, 'user_A');
  const ok = mkRes();
  await reserveHandler({ method: 'POST', headers: {}, body: { bookKey: 'abcdefgh1234' } }, ok, { auth: asUser('user_A'), consentStore: store, env: {}, store: { reserve: async () => ({ status: 'ok', used: 1, paid: false }) } });
  assert.notEqual(ok.code, 403);
});

test('item 8: print-order create and quote refuse (403) without consent', async () => {
  const env = { PRINT_ORDER_ENABLED: 'true' };
  for (const [name, method] of [['create', 'POST'], ['quote', 'GET']]) {
    const res = mkRes();
    await endpoint(name)({ method, headers: {}, query: {}, body: {} }, res, {
      env, store: {}, auth: asUser('user_A'), consentStore: createMemoryConsentStore(),
    });
    assert.equal(res.code, 403, name);
    assert.equal(res.body.error?.code ?? res.body.code, 'consent_required', name);
  }
});

test('GATE fail-closed: if the deletion-marker check cannot run, the acceptance is refused (503) and nothing is saved', async () => {
  const store = createMemoryConsentStore();
  store.isDeleting = async () => { throw new Error('account_deletions unreachable'); };
  const res = mkRes();
  await consentHandler({ method: 'POST', headers: { 'user-agent': 'ua' }, body: goodBody }, res, { auth: asUser('user_A'), consentStore: store });
  assert.equal(res.code, 503);
  assert.equal(res.body.error.code, 'consent_unavailable');
  assert.equal(store._rows.length, 0);
});

test('GATE: a user who is being deleted gets 409 on the consent endpoint and nothing is saved', async () => {
  const store = createMemoryConsentStore();
  store._deleting.add('user_A');
  const res = mkRes();
  await consentHandler({ method: 'POST', headers: {}, body: goodBody }, res, { auth: asUser('user_A'), consentStore: store });
  assert.equal(res.code, 409);
  assert.equal(res.body.error.code, 'account_deleting');
  assert.equal(store._rows.length, 0);
});

test('GATE: print-order create without any consent store is refused (503), there is no skip path', async () => {
  const res = mkRes();
  await endpoint('create')({ method: 'POST', headers: {}, query: {}, body: {} }, res, { env: { PRINT_ORDER_ENABLED: 'true' }, store: {}, auth: asUser('user_A') });
  assert.equal(res.code, 503);
  assert.equal(res.body.error?.code, 'consent_unavailable');
});

/* ---------- grace for the previous policy version ---------- */
const before = new Date('2026-12-01T10:00:00+02:00');
const after = new Date('2026-12-16T00:00:01+02:00');
const savePrev = (store, userId) => store.save({ userId, policyVersion: PREVIOUS_POLICY_VERSION, items: {}, locale: 'he', userAgent: null });

test('GRACE: a parent on the previous version keeps the AI routes before the date', async () => {
  const store = createMemoryConsentStore();
  await savePrev(store, 'user_A');
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: store, now: before }), false);
  assert.equal(res.code, 200);
  // ...but the browser question "did you accept the CURRENT version" is still no
  assert.equal(await hasConsent({ store, userId: 'user_A' }), false);
});

test('GRACE: after the date the previous version is refused with the new refresh message', async () => {
  const store = createMemoryConsentStore();
  await savePrev(store, 'user_A');
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: store, now: after }), true);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'consent_required');
  assert.match(res.body.error, /רעננו את הדף/);
  assert.equal(previousVersionStillAccepted(new Date(PREVIOUS_VERSION_ACCEPTED_UNTIL)), true);
});

test('GRACE: only the previous version is graced, not older ones, and nobody without a record', async () => {
  const store = createMemoryConsentStore();
  await store.save({ userId: 'user_A', policyVersion: '2026-11-09', items: {}, locale: 'he', userAgent: null });
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: store, now: before }), true);
  assert.equal(res.code, 403);
  const none = mkRes();
  assert.equal(await requireConsent({}, none, 'user_Z', { consentStore: store, now: before }), true);
});

test('GRACE: acceptance is recorded for the CURRENT version only, never the previous one', async () => {
  const store = createMemoryConsentStore();
  const r = await recordConsent({ store, userId: 'user_A', body: { ...goodBody, policyVersion: PREVIOUS_POLICY_VERSION }, userAgent: 'x' });
  assert.equal(r.http, 400);
  assert.equal(r.body.error.code, 'stale_version');
  assert.equal(store._rows.length, 0);
});

test('GRACE: a store failure during the grace check still fails closed (503)', async () => {
  const broken = { has: async () => false, hasAny: async () => { throw new Error('db down'); } };
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { consentStore: broken, now: before }), true);
  assert.equal(res.code, 503);
});

test('RETURNING: GET says returning:true for a parent with only an older version, false for new and for accepted', async () => {
  const store = createMemoryConsentStore();
  await savePrev(store, 'user_old');
  const get = async (u) => {
    const r = mkRes();
    await consentHandler({ method: 'GET', headers: {} }, r, { auth: asUser(u), consentStore: store });
    return r.body;
  };
  assert.deepEqual(await get('user_old'), { hasConsent: false, returning: true, policyVersion: CURRENT_POLICY_VERSION });
  assert.equal((await get('user_new')).returning, false);
  await accept(store, 'user_old');
  const done = await get('user_old');
  assert.equal(done.hasConsent, true);
  assert.equal(done.returning, false);
});
