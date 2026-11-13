import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../api/chat-faq.js';

test('IL prompt has shekel prices only', () => {
  const p = buildSystemPrompt('IL');
  assert.ok(p.includes('14.90 ₪'));
  assert.ok(p.includes('תיפתח בקרוב'));
  assert.ok(!p.includes('$3.90'));
  assert.ok(!p.includes('$'));
});
test('unknown country gets the Israel set', () => {
  assert.ok(buildSystemPrompt('').includes('14.90 ₪'));
  assert.ok(buildSystemPrompt(undefined).includes('14.90 ₪'));
});
test('US prompt has dollar prices only', () => {
  const p = buildSystemPrompt('US');
  assert.ok(p.includes('$3.90'));
  assert.ok(!p.includes('₪'));
});
test('every prompt forbids other currencies and conversion', () => {
  for (const c of ['IL', 'US', '']) assert.ok(buildSystemPrompt(c).includes('לא להמיר בין מטבעות'));
});

// The answer itself is checked, not only the prompt: a user can ask for dollars.
import { guardAnswer, IL_SAFE_PRICE_ANSWER } from '../api/chat-faq.js';
test('IL or unknown visitor never receives an answer with dollars', () => {
  assert.equal(guardAnswer('בחו"ל זה $3.90 לחודש', 'IL'), IL_SAFE_PRICE_ANSWER);
  assert.equal(guardAnswer('זה 3.90 דולר', ''), IL_SAFE_PRICE_ANSWER);
  assert.equal(guardAnswer('It costs 3.90 USD', undefined), IL_SAFE_PRICE_ANSWER);
  assert.ok(!IL_SAFE_PRICE_ANSWER.includes('$'));
});
test('answers without dollars pass unchanged; abroad answers pass unchanged', () => {
  assert.equal(guardAnswer('לייט עולה 14.90 ₪ לחודש', 'IL'), 'לייט עולה 14.90 ₪ לחודש');
  assert.equal(guardAnswer('Lite is $3.90 a month', 'US'), 'Lite is $3.90 a month');
});
