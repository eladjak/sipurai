// Shared test fixtures for tests/orders-*.test.mjs (not a test file itself).
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { createMemoryStore } from '../api/_lib/orders/store.js';
import { createMockPayment, MOCK_SECRET } from '../api/_lib/orders/payment/mock.js';
import { createMockVendor } from '../api/_lib/bookpod/mock.js';

export const ALICE = 'user_alice';
export const BOB = 'user_bob';
export const ADMIN = 'user_admin';

export const GOOD_ADDRESS = {
  fullName: 'דנה כהן',
  phone: '050-1234567',
  city: 'חיפה',
  street: 'הנשיא',
  houseNumber: '12',
};

export const PRINT_FILES = { contentUrl: 'https://files.test/content.pdf', coverUrl: 'https://files.test/cover.pdf' };

// Generated per run, never a literal.
export const CRON_TOKEN = crypto.randomBytes(12).toString('hex');

export const BASE_ENV = Object.freeze({
  PRINT_ORDER_ENABLED: 'true',
  PRINT_ADMIN_CLERK_IDS: ADMIN,
  CRON_SECRET: CRON_TOKEN,
});

/** Auth fake: "Bearer user:<sub>" -> that user; anything else -> 401. */
export async function fakeAuth(req) {
  const h = req.headers?.authorization || '';
  const m = /^Bearer user:(.+)$/.exec(h);
  return m ? { ok: true, payload: { sub: m[1] } } : { ok: false, reason: 'no token' };
}

export function makeDeps({ env = {}, vendorScript = ['success'], books, withFiles = true } = {}) {
  const store = createMemoryStore({
    books: books || [
      { id: 'book-alice', ownerId: ALICE, title: 'הדרקון של נועה', printSize: null, printFiles: withFiles ? PRINT_FILES : null },
      { id: 'book-bob', ownerId: BOB, title: 'ספר של בוב', printSize: null, printFiles: withFiles ? PRINT_FILES : null },
      { id: 'book-alice-200', ownerId: ALICE, title: 'ריבוע קטן', printSize: 'square-200', printFiles: PRINT_FILES },
    ],
  });
  const payment = createMockPayment();
  const vendor = createMockVendor(vendorScript);
  // the privacy gate is tested in consent.test.mjs; here every parent has accepted
  const consentStore = { has: async () => true, isDeleting: async () => false };
  return { env: { ...BASE_ENV, ...env }, store, payment, vendor, auth: fakeAuth, consentStore };
}

export function fakeRes() {
  return {
    statusCode: 0,
    body: undefined,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(n) {
      this.statusCode = n;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
    end() {
      return this;
    },
  };
}

export function fakeReq({ method = 'GET', user, query = {}, body, headers = {} } = {}) {
  return {
    method,
    query,
    body,
    headers: { ...(user ? { authorization: `Bearer user:${user}` } : {}), ...headers },
  };
}

/** Call an endpoint and return {status, body}; every response is recorded for the vendor-name scan. */
export const seen = [];
export async function call(handler, req, deps) {
  const res = fakeRes();
  await handler(req, res, deps);
  seen.push(JSON.stringify(res.body ?? null));
  return { status: res.statusCode, body: res.body };
}

/** Raw-body request for api/webhooks/creem.js. */
export function webhookReq(raw, headers) {
  const stream = Readable.from([Buffer.from(raw)]);
  stream.method = 'POST';
  stream.headers = headers;
  return stream;
}

export { MOCK_SECRET };
