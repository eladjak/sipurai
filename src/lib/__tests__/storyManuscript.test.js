import { describe, expect, it } from 'vitest';
import { editedPages, cleanStoryText, manuscriptRequest } from '../storyManuscript';

describe('whole-story editing', () => {
  const page = { page_number: 0, text_content: 'הָיֹה הָיָה.', image_prompt: 'fox opens the gate' };
  it('preserves niqqud and removes cantillation and spaces before punctuation', () => {
    expect(cleanStoryText('שָׁל֑וֹם !', true)).toBe('שָׁלוֹם!');
  });
  it('accepts only a complete manuscript in the intended order', () => {
    expect(editedPages({ pages: [page] }, 1)).toEqual([page]);
    expect(editedPages({ pages: [page, page] }, 2)).toBeNull();
    expect(editedPages({ pages: [page] }, 2)).toBeNull();
  });
  it('carries the approved story sequence and cast through editing', () => {
    const request = manuscriptRequest({ outline: [{ description: 'lost the key' }, { description: 'finds the gate' }], cast: 'Tamar', scenes: [], language: 'hebrew' });
    expect(request.prompt).toContain('lost the key');
    expect(request.prompt).toContain('finds the gate');
    expect(request.prompt).toContain('Tamar');
  });
});
