import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/payments/checkout.js';

const mkRes = () => {
  const r = { code: 200, body: null, headers: {} };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = () => r;
  return r;
};
const call = async (country, vercel = false) => {
  if (vercel) process.env.VERCEL = '1'; else delete process.env.VERCEL;
  const res = mkRes();
  const headers = country ? { 'x-vercel-ip-country': country } : {};
  await handler({ method: 'POST', headers, body: { productId: 'prod_x', customerEmail: 'a@example.com' } }, res);
  return res;
};

const withFetch = async (fn) => {
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ checkout_url: 'https://c.example/x' }) }; };
  try { return await fn(() => calls); } finally { globalThis.fetch = realFetch; delete process.env.VERCEL; delete process.env.BILLING_ILS_ENABLED; }
};

test('IL visitor is refused even if a legacy enable flag is set', async () => {
  process.env.CREEM_API_KEY = 'ck_test_fake';
  process.env.BILLING_ILS_ENABLED = 'true';
  await withFetch(async (calls) => {
    const res = await call('IL');
    assert.equal(res.code, 409);
    assert.equal(res.body.error, 'il_billing_not_open');
    assert.equal(calls(), 0);
  });
});

test('missing country on Vercel fails closed with country_unknown', async () => {
  process.env.CREEM_API_KEY = 'ck_test_fake';
  await withFetch(async (calls) => {
    const res = await call(undefined, true);
    assert.equal(res.code, 409);
    assert.equal(res.body.error, 'country_unknown');
    assert.equal(calls(), 0);
  });
});

test('missing country off Vercel (local dev) proceeds', async () => {
  process.env.CREEM_API_KEY = 'ck_test_fake';
  await withFetch(async (calls) => {
    const res = await call(undefined, false);
    assert.equal(res.code, 200);
    assert.equal(calls(), 1);
  });
});

test('IL visitor is refused with 409 before Creem is called', async () => {
  process.env.CREEM_API_KEY = 'ck_test_fake';
  delete process.env.BILLING_ILS_ENABLED;
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ checkout_url: 'https://c.example/x' }) }; };
  try {
    const res = await call('IL');
    assert.equal(res.code, 409);
    assert.equal(res.body.error, 'il_billing_not_open');
    assert.equal(calls, 0);
  } finally { globalThis.fetch = realFetch; }
});

test('US visitor proceeds to Creem', async () => {
  process.env.CREEM_API_KEY = 'ck_test_fake';
  delete process.env.BILLING_ILS_ENABLED;
  let calls = 0;
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => ({ checkout_url: 'https://c.example/x' }) }; };
  try {
    const res = await call('US');
    assert.equal(res.code, 200);
    assert.equal(res.body.checkout_url, 'https://c.example/x');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = realFetch; }
});
