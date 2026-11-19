import { describe, expect, it } from 'vitest';
import { buildRecipe } from '../bookRecipe';

describe('picture-book generation recipe', () => {
  const bookData = { title: 'הֶחָבֵר הַנִּסְתָּר', language: 'hebrew', genre: 'adventure' };

  it('uses the supplied opening and separates the first illustration from the cover', () => {
    const recipe = buildRecipe({ bookData, scenes: [{ description: 'A cardboard rocket lands in a pomegranate orchard' }] });
    const body = recipe.imagePrompt({ image_prompt: 'A child steps out beside the orchard gate' }, 1);

    expect(recipe.coverPrompt).toContain('cardboard rocket');
    expect(recipe.coverPrompt).toContain('הֶחָבֵר הַנִּסְתָּר');
    expect(body).toContain('distinct from the cover');
    expect(body).toContain('orchard gate');
    expect(body).toContain('quiet lower quarter');
    expect([0, 1, 2, 3].map(recipe.layoutFor)).toEqual(['cover', 'image_full', 'image_full', 'image_full']);
  });

  it('asks for contextual vowel points only for generated Hebrew titles', () => {
    expect(buildRecipe({ bookData }).outlinePrompt).toContain('הֶחָבֵר הַנִּסְתָּר');
    expect(buildRecipe({ bookData: { title: 'The Hidden Friend', language: 'english' } }).outlinePrompt).not.toContain('נקד');
    expect(buildRecipe({ bookData }).approvedTitle).toBe(bookData.title);
    expect(buildRecipe({ bookData: { title: 'החבר הנסתר', language: 'hebrew' } }).selectTitle('הֶחָבֵר הַנִּסְתָּר')).toBe('הֶחָבֵר הַנִּסְתָּר');
    expect(buildRecipe({ bookData: { title: 'The Friend', language: 'english' } }).selectTitle('Another title')).toBe('The Friend');
  });
});

it('uses stable story-specific cover framing and a different opening framing', () => {
  const inputs = { bookData: { title: 'אורי והדרקון', language: 'hebrew' }, scenes: [{ description: 'A dragon hides under a bridge' }] };
  const first = buildRecipe(inputs);
  const resumed = buildRecipe(inputs);
  expect(first.coverPrompt).toBe(resumed.coverPrompt);
  expect(first.imagePrompt({ image_prompt: 'bridge' }, 1)).toBe(resumed.imagePrompt({ image_prompt: 'bridge' }, 1));
  const covers = Array.from({ length: 20 }, (_, i) => buildRecipe({ ...inputs, bookData: { ...inputs.bookData, title: `Story ${i}` } }).coverPrompt.match(/Use (.*?) and a silhouette/)[1]);
  expect(new Set(covers).size).toBeGreaterThan(1);
});
