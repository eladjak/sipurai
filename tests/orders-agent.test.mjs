// סוכן agent key on the admin order endpoints. Run: node --test tests/orders-agent.test.mjs
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { endpoint } from '../api/_lib/orders/handlers.js';
import { resetRateLimitForTests } from '../api/_lib/agentKey.js';
import { ALICE, GOOD_ADDRESS, call, fakeReq, makeDeps } from './orders-helpers.mjs';

const RAW = `sagent_${crypto.randomBytes(32).toString('hex')}`;
const HASH = crypto.createHash('sha256').update(RAW).digest('hex');
const CONFIRM = 'WhatsApp from Elad 13.11 09:02: cancel order awaiting payment';
const enc = encodeURIComponent;
const list = endpoint('admin-list');
const act = endpoint('admin-action');
const create = endpoint('create');

const agentReq = (method, { key = RAW, confirm, body, query } = {}) =>
  fakeReq({ method, body, query, headers: { authorization: `Bearer ${key}`, ...(confirm ? { 'x-agent-confirm': enc(confirm) } : {}) } });

async function orderId(deps) {
  const r = await call(create, fakeReq({ method: 'POST', user: ALICE, body: { bookId: 'book-alice', qty: 1, method: 'ship', address: GOOD_ADDRESS, idempotencyKey: 'key-agent-0001' } }), deps);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.orderId;
}
beforeEach(() => resetRateLimitForTests());
const deps = () => makeDeps({ env: { SIPURAI_AGENT_KEY_SHA256: HASH } });

test('key works on admin-list (200); no key 401; wrong key 401; revoked (hash removed) 401', async () => {
  const d = deps();
  assert.equal((await call(list, agentReq('GET'), d)).status, 200);
  assert.equal((await call(list, fakeReq({ method: 'GET' }), d)).status, 401);
  assert.equal((await call(list, agentReq('GET', { key: `sagent_${'0'.repeat(64)}` }), d)).status, 401);
  const revoked = makeDeps({ env: { SIPURAI_AGENT_KEY_SHA256: '' } });
  assert.equal((await call(list, agentReq('GET'), revoked)).status, 401);
});

test('the agent key does NOT work on non-admin endpoints (create / mine)', async () => {
  const d = deps();
  assert.equal((await call(endpoint('mine'), agentReq('GET'), d)).status, 401);
  assert.equal((await call(create, agentReq('POST', { body: {} }), d)).status, 401);
});

test('guarded actions without confirm -> 428 with the right class, order untouched, nothing audited', async () => {
  const d = deps();
  const id = await orderId(d);
  for (const [action, cls] of [['cancel', 'delete'], ['retry_submit', 'money'], ['mark_shipped', 'send'], ['mark_ready_for_pickup', 'send']]) {
    const r = await call(act, agentReq('POST', { body: { id, action } }), d);
    assert.equal(r.status, 428, action);
    assert.deepEqual(r.body, { error: 'agent_confirm_required', class: cls, reason: 'missing' });
  }
  assert.equal(d.store._orders.get(id).status, 'awaiting_payment');
  assert.equal(d.store._agentAudit.length, 0);
});

test('short confirm -> still 428', async () => {
  const d = deps();
  const id = await orderId(d);
  assert.equal((await call(act, agentReq('POST', { confirm: 'yes ok', body: { id, action: 'cancel' } }), d)).status, 428);
});

test('Step 0: invisible-only or oversized confirm -> 428 with reason, order untouched', async () => {
  const d = deps();
  const id = await orderId(d);
  for (const [label, confirm, reason] of [['10 emoji', '😀'.repeat(10), 'too_short'], ['20 zero-width spaces', '\u200B'.repeat(20), 'too_short'],
    ['20 combining marks', '\u0301'.repeat(20), 'too_short'], ['601 chars', 'א'.repeat(601), 'too_long']]) {
    const r = await call(act, agentReq('POST', { confirm, body: { id, action: 'cancel' } }), d);
    assert.equal(r.status, 428, label);
    assert.deepEqual(r.body, { error: 'agent_confirm_required', class: 'delete', reason }, label);
  }
  assert.equal(d.store._orders.get(id).status, 'awaiting_payment');
  assert.equal(d.store._agentAudit.length, 0);
});

test('Step 0: a normal Hebrew sentence of 25 letters is accepted and stored whole', async () => {
  const d = deps();
  const id = await orderId(d);
  const text = 'אלעד אישר בוואטסאפ ביטול';
  const r = await call(act, agentReq('POST', { confirm: text, body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(d.store._agentAudit[0].confirm_text, text);
});

test('cancel with a Hebrew confirm statement: executed, audit row carries the text, event actor is סוכן', async () => {
  const d = deps();
  const id = await orderId(d);
  const text = 'וואטסאפ מאלעד 13.11 09:02: לבטל הזמנה שלא שולמה';
  const r = await call(act, agentReq('POST', { confirm: text, body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(d.store._orders.get(id).status, 'cancelled');
  assert.deepEqual(d.store._agentAudit.map((a) => [a.actor, a.action, a.guard_class, a.target, a.confirm_text]),
    [['סוכן', 'orders.cancel', 'delete', id, text]]);
  assert.equal(d.store._events.find((e) => e.type === 'admin_cancel').data.actor, 'סוכן');
});

test('audit write failure -> 503 and the action does NOT run (fail closed)', async () => {
  const d = deps();
  const id = await orderId(d);
  d.store.addAgentAudit = async () => { throw new Error('db down'); };
  const r = await call(act, agentReq('POST', { confirm: CONFIRM, body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 503);
  assert.equal(d.store._orders.get(id).status, 'awaiting_payment');
});

test('61st guarded write in a minute -> 429', async () => {
  const d = deps();
  const id = await orderId(d);
  for (let i = 0; i < 60; i++) {
    const r = await call(act, agentReq('POST', { confirm: CONFIRM, body: { id, action: 'mark_shipped' } }), d);
    assert.notEqual(r.status, 429);
  }
  assert.equal((await call(act, agentReq('POST', { confirm: CONFIRM, body: { id, action: 'mark_shipped' } }), d)).status, 429);
});

test('a Clerk admin session is unchanged: cancel without any confirm header still works', async () => {
  const d = makeDeps();
  const id = await orderId(d);
  const r = await call(act, fakeReq({ method: 'POST', user: 'user_admin', body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 200);
  assert.equal(d.store._agentAudit.length, 0);
});

test('release review 13.11: the limit is shared across instances (audit table is the counter)', async () => {
  const d = deps();
  const id = await orderId(d);
  // 60 guarded writes made by ANOTHER serverless instance in the last minute (this process's in-memory counter is empty).
  for (let i = 0; i < 60; i++) await d.store.addAgentAudit({ actor: 'סוכן', action: 'orders.mark_shipped', guard_class: 'send', target: id, confirm_text: CONFIRM });
  const r = await call(act, agentReq('POST', { confirm: CONFIRM, body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 429);
  assert.equal(d.store._orders.get(id).status, 'awaiting_payment');
});

test('release review 13.11: shared counter unavailable -> 503, action does not run', async () => {
  const d = deps();
  const id = await orderId(d);
  d.store.countAgentAuditSince = async () => { throw new Error('db down'); };
  const r = await call(act, agentReq('POST', { confirm: CONFIRM, body: { id, action: 'cancel' } }), d);
  assert.equal(r.status, 503);
  assert.equal(d.store._orders.get(id).status, 'awaiting_payment');
});
