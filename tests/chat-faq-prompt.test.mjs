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
