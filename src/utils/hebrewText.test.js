import { describe, it, expect } from 'vitest';
import { containsHebrew, firstStrongIsRTL, toVisualRTL, linesToVisualRTL, arrayBufferToBase64 } from './hebrewText';

describe('containsHebrew', () => {
  it('detects Hebrew', () => {
    expect(containsHebrew('שלום')).toBe(true);
    expect(containsHebrew('hello שלום')).toBe(true);
  });
  it('rejects non-Hebrew and empty', () => {
    expect(containsHebrew('hello')).toBe(false);
    expect(containsHebrew('')).toBe(false);
    expect(containsHebrew(null)).toBe(false);
  });
});

describe('firstStrongIsRTL', () => {
  it('Hebrew-first paragraph is RTL', () => {
    expect(firstStrongIsRTL('שלום Dani')).toBe(true);
    expect(firstStrongIsRTL('"שלום" אמר דני')).toBe(true); // punctuation is weak
  });
  it('English-first paragraph is LTR', () => {
    expect(firstStrongIsRTL('A line with דניאל inside')).toBe(false);
    expect(firstStrongIsRTL('hello')).toBe(false);
    expect(firstStrongIsRTL('')).toBe(false);
  });
});

describe('toVisualRTL', () => {
  it('keeps English-first mixed lines LTR, reversing only Hebrew runs', async () => {
    expect(await toVisualRTL('Hi דני!')).toBe('Hi ינד!');
  });

  it('returns non-Hebrew text unchanged', async () => {
    expect(await toVisualRTL('hello world')).toBe('hello world');
  });

  it('reverses pure Hebrew into visual order', async () => {
    // logical "שלום עולם" → visual (drawn LTR) "םלוע םולש"
    expect(await toVisualRTL('שלום עולם')).toBe('םלוע םולש');
  });

  it('keeps embedded numbers in LTR order', async () => {
    // digits are an LTR run inside the RTL line — must NOT be reversed
    expect(await toVisualRTL('שלום 123')).toBe('123 םולש');
  });

  it('mirrors brackets', async () => {
    // logical "(שלום)" → visual "(םולש)" — parens swap sides via mirroring
    expect(await toVisualRTL('(שלום)')).toBe('(םולש)');
  });

  it('keeps embedded Latin words readable', async () => {
    expect(await toVisualRTL('שלום Dani')).toBe('Dani םולש');
  });
});

describe('linesToVisualRTL', () => {
  it('reorders each line independently', async () => {
    const out = await linesToVisualRTL(['שלום עולם', 'hello']);
    expect(out).toEqual(['םלוע םולש', 'hello']);
  });
  it('wraps a single string into an array', async () => {
    expect(await linesToVisualRTL('שלום')).toEqual(['םולש']);
  });
});

describe('arrayBufferToBase64', () => {
  it('encodes bytes correctly', () => {
    const buf = new TextEncoder().encode('abc').buffer;
    expect(arrayBufferToBase64(buf)).toBe('YWJj');
  });
});
