import assert from 'node:assert/strict';
import test from 'node:test';
import { spreadSuggestion } from '../src/lib/printEdition/spreadSuggestion.js';

const forest = 'Maya and Uri both peer into the dark hollow under the old oak';
const imagePrompt = (detail = forest, beat = 'The friends reach the old oak') =>
  `Keep character identity. Scene role: midpoint. Scene beat: ${beat}. Featuring: Maya and Uri. Scene: ${detail}. Children's book illustration in watercolor style.`;
const first = { page_number: 6, image_prompt: imagePrompt() };
const second = { page_number: 7, image_prompt: imagePrompt() };

test('requires structured, specific shared directions on adjacent pages', () => {
  assert.equal(spreadSuggestion(first, second), 'same-scene');
  assert.equal(spreadSuggestion(first, { ...second, page_number: 8 }), null);
  assert.equal(spreadSuggestion(first, { ...second, image_prompt: imagePrompt('Maya and Uri turn away from the oak and enter their classroom') }), null);
  assert.equal(spreadSuggestion(first, { ...second, image_prompt: imagePrompt(forest, 'A separate flashback') }), null);
  assert.equal(spreadSuggestion(first, { ...second, image_prompt: '[Image generation failed] ' + imagePrompt() }), null);
  assert.equal(spreadSuggestion({ ...first, image_prompt: forest }, { ...second, image_prompt: forest }), null);
  assert.equal(spreadSuggestion({ ...first, image_prompt: imagePrompt('A forest') }, { ...second, image_prompt: imagePrompt('A forest') }), null);
});

test('recognizes a deliberately saved print panorama independently of prompts', () => {
  assert.equal(spreadSuggestion({ page_number: 6 }, { page_number: 7 }, 'saved-print-art'), 'saved-panorama');
  assert.equal(spreadSuggestion({ page_number: 6 }, { page_number: 8 }, 'saved-print-art'), null);
});
