import test from 'node:test';
import assert from 'node:assert/strict';
import generateHandler from '../api/ai/generate.js';
import { createMemoryConsentStore, recordConsent } from '../api/_lib/consent.js';
import { CURRENT_POLICY_VERSION } from '../api/_lib/policyVersion.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = () => {};
  r.end = () => r;
  return r;
};

test('the server log never contains the story prompt (it can hold a child\'s name)', async () => {
  const SECRET = 'דנה-בת-חמש-מרחוב-הרצל-17';
  const consentStore = createMemoryConsentStore();
  await recordConsent({ store: consentStore, userId: 'user_A', body: { policyVersion: CURRENT_POLICY_VERSION, items: { guardian_18: true, privacy_children_abroad: true, terms: true }, locale: 'he' }, userAgent: 'x' });
  const lines = [];
  const orig = console.log;
  console.log = (...a) => { lines.push(a.map(String).join(' ')); };
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key';
  try {
    const res = mkRes();
    await generateHandler({ method: 'POST', headers: { 'x-forwarded-for': `t${Math.random()}` }, body: { prompt: SECRET, type: 'not-a-type' } }, res, {
      auth: async () => ({ ok: true, payload: { sub: 'user_A' } }), consentStore,
    });
    assert.equal(res.code, 400, 'the request must reach the REQUEST log line before it is rejected');
  } finally {
    console.log = orig;
    if (prevKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevKey;
  }
  const all = lines.join('\n');
  assert.ok(all.includes('REQUEST'), 'the request was logged');
  assert.ok(!all.includes(SECRET), 'prompt text must not be logged');
  assert.ok(!all.includes('promptPreview'));
  assert.ok(all.includes('promptLength'), 'length is still logged');
});
