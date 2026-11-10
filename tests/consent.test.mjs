import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryConsentStore, requireConsent, recordConsent, hasConsent, validateAcceptance, forgetConsent } from '../api/_lib/consent.js';
import { CURRENT_POLICY_VERSION } from '../api/_lib/policyVersion.js';
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
const goodBody = { policyVersion: CURRENT_POLICY_VERSION, items: { guardian_18: true, policy_and_terms: true }, locale: 'he' };
const accept = (store, userId) => recordConsent({ store, userId, body: goodBody, userAgent: 'test-agent' });

test('no consent record -> 403 with a clear code, before anything else runs', async () => {
  const res = mkRes();
  const stopped = await requireConsent({}, res, 'user_A', { store: createMemoryConsentStore() });
  assert.equal(stopped, true);
  assert.equal(res.code, 403);
  assert.equal(res.body.code, 'consent_required');
  assert.match(res.body.error, /מדיניות הפרטיות/);
});

test('after the parent accepts, the same user passes and another user still does not', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_A');
  const a = mkRes();
  assert.equal(await requireConsent({}, a, 'user_A', { store }), false);
  assert.equal(a.code, 200);
  const b = mkRes();
  assert.equal(await requireConsent({}, b, 'user_B', { store }), true);
  assert.equal(b.code, 403);
});

test('bumping the policy version asks everyone again', async () => {
  const store = createMemoryConsentStore();
  await store.save({ userId: 'user_A', policyVersion: '2025-01-01', items: {}, locale: 'he', userAgent: null });
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { store }), true);
  assert.equal(res.code, 403);
});

test('a store that cannot answer fails CLOSED (503), never open', async () => {
  const broken = { has: async () => { throw new Error('db down'); } };
  const res = mkRes();
  assert.equal(await requireConsent({}, res, 'user_A', { store: broken }), true);
  assert.equal(res.code, 503);
  assert.equal(res.body.code, 'consent_unavailable');
});

test('acceptance needs the exact current version and BOTH boxes', () => {
  assert.equal(validateAcceptance({ ...goodBody, policyVersion: 'old' }).code, 'stale_version');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true } }).code, 'items_missing');
  assert.equal(validateAcceptance({ ...goodBody, items: { guardian_18: true, policy_and_terms: 'yes' } }).code, 'items_missing');
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
  assert.deepEqual(row.items, { guardian_18: true, policy_and_terms: true });
  assert.equal(row.locale, 'he');
  assert.equal(row.user_agent.length, 300);
  // accepting twice stays one row
  await accept(store, 'user_A');
  assert.equal(store._rows.length, 1);
});

test('consent endpoint: needs login; user comes from the token, never from the body', async () => {
  const store = createMemoryConsentStore();
  const anon = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, anon, { auth: noUser, store });
  assert.equal(anon.code, 401);

  // user A posts a body that tries to name user B
  const post = mkRes();
  await consentHandler({ method: 'POST', headers: { 'user-agent': 'ua' }, body: { ...goodBody, userId: 'user_B', user_id: 'user_B' } }, post, { auth: asUser('user_A'), store });
  assert.equal(post.code, 200);
  assert.equal(await hasConsent({ store, userId: 'user_A' }), true);
  assert.equal(await hasConsent({ store, userId: 'user_B' }), false);

  const getB = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, getB, { auth: asUser('user_B'), store });
  assert.equal(getB.body.hasConsent, false);
  const getA = mkRes();
  await consentHandler({ method: 'GET', headers: {} }, getA, { auth: asUser('user_A'), store });
  assert.equal(getA.body.hasConsent, true);
});

test('AI routes: generate and tts answer 403 consent_required when the parent has not accepted', async () => {
  for (const [name, handler] of [['generate', generateHandler], ['tts', ttsHandler]]) {
    const store = createMemoryConsentStore();
    const res = mkRes();
    await handler({ method: 'POST', headers: {}, body: { prompt: 'שלום', type: 'text', text: 'שלום', provider: 'openai' } }, res, { auth: asUser('user_A'), store });
    assert.equal(res.code, 403, `${name} should refuse without consent`);
    assert.equal(res.body.code, 'consent_required', name);
  }
});

test('AI routes: with consent the request goes past the privacy gate', async () => {
  for (const [name, handler] of [['generate', generateHandler], ['tts', ttsHandler]]) {
    const store = createMemoryConsentStore();
    await accept(store, 'user_A');
    forgetConsent('user_A');
    const res = mkRes();
    await handler({ method: 'POST', headers: {}, body: {} }, res, { auth: asUser('user_A'), store });
    assert.ok(![401, 403, 503].includes(res.code), `${name} got ${res.code}; it should be past the gate (400/500 from later checks)`);
    assert.notEqual(res.body?.code, 'consent_required', name);
  }
});

test('AI routes: another user\'s consent does not open the gate for this user', async () => {
  const store = createMemoryConsentStore();
  await accept(store, 'user_B');
  const res = mkRes();
  await generateHandler({ method: 'POST', headers: {}, body: { prompt: 'x', type: 'text' } }, res, { auth: asUser('user_A'), store });
  assert.equal(res.code, 403);
});
