import { describe, it, expect } from 'vitest';
import {
  BOOK_STATUS,
  isPageReady,
  isPageIllustrated,
  normalizePages,
  readablePages,
  summarizeBook,
  deriveStatus,
  isResumable,
  viewState,
} from '@/lib/bookProgress';

const page = (n, over = {}) => ({
  id: `p${n}`,
  page_number: n,
  text_content: `text ${n}`,
  image_url: `http://img/${n}.png`,
  ...over,
});

describe('isPageReady', () => {
  it('treats a skeleton row as not readable', () => {
    expect(isPageReady(page(0, { text_content: '' }))).toBe(false);
    expect(isPageReady(page(0, { text_content: '   ' }))).toBe(false);
    expect(isPageReady(page(0, { text_content: null }))).toBe(false);
    expect(isPageReady(null)).toBe(false);
  });

  it('treats a row with text as readable even with no picture', () => {
    expect(isPageReady(page(0, { image_url: '' }))).toBe(true);
    expect(isPageIllustrated(page(0, { image_url: '' }))).toBe(false);
    expect(isPageIllustrated(page(0))).toBe(true);
  });
});

describe('normalizePages', () => {
  it('orders by page number and keeps the most complete duplicate', () => {
    const rows = [
      page(2),
      page(0, { id: 'dup-empty', text_content: '' }),
      page(0, { id: 'dup-full' }),
      page(1, { image_url: '' }),
    ];
    const out = normalizePages(rows);
    expect(out.map((p) => p.page_number)).toEqual([0, 1, 2]);
    expect(out[0].id).toBe('dup-full');
  });

  it('survives junk input', () => {
    expect(normalizePages(null)).toEqual([]);
    expect(normalizePages([null, undefined])).toEqual([]);
  });
});

describe('summarizeBook', () => {
  it('reports progress against the PLANNED count, not what exists', () => {
    // The case the redesign exists for: two real pages of a ten-page book.
    const pages = [page(0), page(1), ...[2, 3, 4].map((n) => page(n, { text_content: '' }))];
    const s = summarizeBook({ total_pages: 10 }, pages);
    expect(s.total).toBe(10);
    expect(s.ready).toBe(2);
    expect(s.isComplete).toBe(false);
    expect(s.isReadable).toBe(true);
    expect(s.missingText).toEqual([2, 3, 4]);
  });

  it('counts a page with text but no picture as ready, and lists the missing picture', () => {
    const s = summarizeBook({ total_pages: 2 }, [page(0), page(1, { image_url: '' })]);
    expect(s.ready).toBe(2);
    expect(s.illustrated).toBe(1);
    expect(s.isComplete).toBe(true);
    expect(s.missingImage).toEqual([1]);
  });

  it('falls back to the row count when total_pages was never set', () => {
    const s = summarizeBook({}, [page(0), page(1)]);
    expect(s.total).toBe(2);
    expect(s.isComplete).toBe(true);
  });

  it('never claims completeness for a book with no pages at all', () => {
    const s = summarizeBook({ total_pages: 10 }, []);
    expect(s.isComplete).toBe(false);
    expect(s.isReadable).toBe(false);
    expect(s.hasSkeleton).toBe(false);
  });
});

describe('deriveStatus', () => {
  it('reads the status off the rows rather than trusting the column', () => {
    // A row that says `generating` while every page is written is a lie the
    // reader must not repeat — this is the closed-tab case.
    expect(deriveStatus({ status: 'generating', total_pages: 2 }, [page(0), page(1)]))
      .toBe(BOOK_STATUS.COMPLETE);
    expect(deriveStatus({ status: 'generating', total_pages: 4 }, [page(0)]))
      .toBe(BOOK_STATUS.PARTIAL);
    expect(deriveStatus({ status: 'generating', total_pages: 4 }, []))
      .toBe(BOOK_STATUS.FAILED);
  });
});

describe('isResumable', () => {
  it('offers to continue anything unfinished, whatever the column says', () => {
    expect(isResumable({ status: 'generating', total_pages: 4 }, [page(0)])).toBe(true);
    expect(isResumable({ status: 'partial', total_pages: 4 }, [page(0)])).toBe(true);
    expect(isResumable({ status: 'failed', total_pages: 4 }, [])).toBe(true);
  });

  it('offers to continue a finished book whose illustrations are missing', () => {
    // Completeness is about text, because text is what makes a page readable.
    // A picture book with no pictures is therefore `complete` and still has
    // real work left — and must not present itself as nothing-to-do.
    const artless = [page(0, { image_url: '' }), page(1, { image_url: '' })];
    expect(isResumable({ status: 'complete', total_pages: 2 }, artless)).toBe(true);
  });

  it('does not offer to continue a finished book', () => {
    expect(isResumable({ status: 'complete', total_pages: 1 }, [page(0)])).toBe(false);
    // Even a row still labelled `generating` is done if every page is there.
    expect(isResumable({ status: 'generating', total_pages: 1 }, [page(0)])).toBe(false);
    expect(isResumable(null, [])).toBe(false);
  });
});

describe('viewState', () => {
  const book = { status: 'generating', total_pages: 4 };

  it('says "building" only while a run is actually heartbeating', () => {
    expect(viewState(book, [page(0)], true)).toBe('building');
    expect(viewState(book, [], true)).toBe('starting');
  });

  it('calls a stalled run interrupted rather than showing a spinner forever', () => {
    // Same row, same pages — the only difference is that nothing is working on
    // it. The old UI could not tell these apart and always chose the spinner.
    expect(viewState(book, [page(0)], false)).toBe('interrupted');
    expect(viewState(book, [], false)).toBe('empty');
  });

  it('distinguishes a missing book from an empty one', () => {
    expect(viewState(null, [], false)).toBe('missing');
    expect(viewState(book, [], false)).toBe('empty');
  });

  it('reports complete regardless of the run flag', () => {
    expect(viewState({ total_pages: 1 }, [page(0)], true)).toBe('complete');
    expect(viewState({ total_pages: 1 }, [page(0)], false)).toBe('complete');
  });
});

describe('readablePages', () => {
  it('hides skeleton rows from the reader', () => {
    const rows = [page(0), page(1, { text_content: '' }), page(2)];
    expect(readablePages(rows).map((p) => p.page_number)).toEqual([0, 2]);
  });
});
