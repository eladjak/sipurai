import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBookIncremental, normalizeOutline, pool, IMAGE_FAILED_PREFIX } from '@/lib/bookGeneration';
import { BOOK_STATUS, summarizeBook, readablePages } from '@/lib/bookProgress';

/**
 * An in-memory stand-in for the two Supabase tables.
 *
 * Deliberately NOT a mock of the thing under test: the question these tests ask
 * is "what does the database look like when the run stops here", so the store
 * has to actually store, and the AI — which is not the question — is the part
 * that gets faked.
 */
function makeStore() {
  const books = new Map();
  const pages = new Map();
  let seq = 0;

  const Book = {
    create: vi.fn(async (data) => {
      const id = `book-${++seq}`;
      const row = { id, ...data };
      books.set(id, row);
      return { ...row };
    }),
    get: vi.fn(async (id) => (books.has(id) ? { ...books.get(id) } : null)),
    update: vi.fn(async (id, patch) => {
      const row = { ...books.get(id), ...patch };
      books.set(id, row);
      return { ...row };
    }),
  };

  const pageCreate = async (data) => {
    const id = `page-${++seq}`;
    const row = { id, ...data };
    pages.set(id, row);
    return { ...row };
  };

  const Page = {
    create: vi.fn(pageCreate),
    update: vi.fn(async (id, patch) => {
      const row = { ...pages.get(id), ...patch };
      pages.set(id, row);
      return { ...row };
    }),
    filter: vi.fn(async ({ book_id }) =>
      [...pages.values()].filter((p) => p.book_id === book_id).map((p) => ({ ...p }))
    ),
  };

  return {
    Book,
    Page,
    /** The unfaked implementations, so a test can break a call and then heal it. */
    impl: { pageCreate },
    /** What a reader loading this book right now would find. */
    snapshot: (bookId) => ({
      book: books.get(bookId) ? { ...books.get(bookId) } : null,
      pages: [...pages.values()].filter((p) => p.book_id === bookId).map((p) => ({ ...p })),
    }),
  };
}

function makeRecipe(pageCount = 4) {
  return {
    pageCount,
    bookFields: { title: 'ספר הבדיקה', language: 'hebrew' },
    outlinePrompt: 'outline',
    outlineSchema: { type: 'object' },
    coverPrompt: 'cover',
    pageTextPrompt: (entry, i) => `page ${i}: ${entry.description}`,
    pageTextSchema: () => ({ type: 'object' }),
    imagePrompt: (page, i) => `draw ${i}`,
    layoutFor: (i) => (i === 0 ? 'cover' : 'full'),
    sanitize: (s) => String(s || '').trim(),
    readPageText: (r) => r?.text_content || '',
  };
}

/** An AI that answers instantly, with per-call hooks so a test can break one. */
function makeAi({ failImageAt = [], failTextAt = [], slowImageAt = [] } = {}) {
  return {
    InvokeLLM: vi.fn(async ({ prompt }) => {
      if (prompt === 'outline') {
        return {
          title: 'כותרת מהמודל',
          outline: Array.from({ length: 10 }, (_, i) => ({ page_number: i, description: `beat ${i}` })),
        };
      }
      const index = Number(/page (\d+)/.exec(prompt)?.[1] ?? -1);
      if (failTextAt.includes(index)) throw new Error(`text failed at ${index}`);
      return { text_content: `סיפור עמוד ${index}`, image_prompt: `prompt ${index}` };
    }),
    GenerateImage: vi.fn(async ({ prompt }) => {
      if (prompt === 'cover') return { url: 'http://img/cover.png', base64: 'COVER64' };
      const index = Number(/draw (\d+)/.exec(prompt)?.[1] ?? -1);
      if (slowImageAt.includes(index)) await new Promise((r) => setTimeout(r, 20));
      if (failImageAt.includes(index)) throw new Error(`AI request timed out after 90s`);
      return { url: `http://img/${index}.png`, base64: `IMG${index}` };
    }),
  };
}

const noLock = () => () => {};
const noReference = async () => null;

const run = (over = {}) =>
  generateBookIncremental({
    entities: over.entities,
    ai: over.ai,
    recipe: over.recipe,
    bookId: over.bookId ?? null,
    onEvent: over.onEvent,
    concurrency: over.concurrency ?? 2,
    lock: noLock,
    fetchReference: over.fetchReference ?? noReference,
  });

describe('normalizeOutline', () => {
  it('pads a short outline up to the planned page count', () => {
    // A terse model must not silently shorten the book the parent asked for.
    expect(normalizeOutline([{ description: 'a' }], 3)).toEqual([
      { page_number: 0, description: 'a' },
      { page_number: 1, description: '' },
      { page_number: 2, description: '' },
    ]);
  });

  it('trims a long one and tolerates junk', () => {
    expect(normalizeOutline([{ description: 'a' }, { description: 'b' }], 1)).toHaveLength(1);
    expect(normalizeOutline(null, 2)).toHaveLength(2);
  });
});

describe('pool', () => {
  it('never exceeds the concurrency limit', async () => {
    let live = 0;
    let peak = 0;
    await pool([1, 2, 3, 4, 5, 6], 2, async () => {
      peak = Math.max(peak, ++live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('keeps going when a worker throws', async () => {
    const done = [];
    await pool([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('nope');
      done.push(n);
    });
    expect(done.sort()).toEqual([1, 3]);
  });

  it('stops scheduling once aborted', async () => {
    const ctrl = new AbortController();
    const seen = [];
    await pool([1, 2, 3, 4], 1, async (n) => {
      seen.push(n);
      ctrl.abort();
    }, ctrl.signal);
    expect(seen).toEqual([1]);
  });
});

describe('generateBookIncremental — the happy path', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  it('writes the plan before any page, so progress is measurable from the start', async () => {
    const events = [];
    const result = await run({
      entities: store,
      ai: makeAi(),
      recipe: makeRecipe(4),
      onEvent: (e) => events.push(e),
    });

    const { book, pages } = store.snapshot(result.bookId);
    expect(book.total_pages).toBe(4);
    expect(pages).toHaveLength(4);
    expect(result.status).toBe(BOOK_STATUS.COMPLETE);
    expect(result.ready).toBe(4);

    // The plan is durable before the first word of story is written — that is
    // what a resume on another device reads.
    const planIndex = events.findIndex((e) => e.type === 'plan-saved');
    const firstText = events.findIndex((e) => e.type === 'page-text');
    expect(planIndex).toBeGreaterThan(-1);
    expect(planIndex).toBeLessThan(firstText);
  });

  it('makes page one readable before it starts on the rest', async () => {
    const readableAt = [];
    const ai = makeAi();
    await run({
      entities: store,
      ai,
      recipe: makeRecipe(6),
      onEvent: (e) => {
        if (e.type === 'page-text') readableAt.push(e.index);
      },
    });
    // Page 0's text lands first, always — the parent sees a real page while the
    // remaining nine are still being drawn.
    expect(readableAt[0]).toBe(0);
  });

  it('flips the row to `partial` the moment one page is readable', async () => {
    const statuses = [];
    const store2 = makeStore();
    const realUpdate = store2.Book.update.getMockImplementation();
    store2.Book.update.mockImplementation(async (id, patch) => {
      if (patch.status) statuses.push(patch.status);
      return realUpdate(id, patch);
    });

    await run({ entities: store2, ai: makeAi(), recipe: makeRecipe(3) });
    expect(statuses[0]).toBe(BOOK_STATUS.PARTIAL);
    expect(statuses[statuses.length - 1]).toBe(BOOK_STATUS.COMPLETE);
  });

  it('never leaves the row saying `generating` once the run has ended', async () => {
    const result = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(3) });
    expect(store.snapshot(result.bookId).book.status).not.toBe(BOOK_STATUS.GENERATING);
  });
});

describe('generateBookIncremental — the failing arm', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  it('an illustration that times out costs one picture, not the book', async () => {
    // This is the exact production failure: `proxyCall` aborts an image call at
    // 90s. Under the old code that single rejection took the whole run down and
    // stranded the book. Here it must cost page 2's picture and nothing else.
    const result = await run({
      entities: store,
      ai: makeAi({ failImageAt: [2] }),
      recipe: makeRecipe(4),
    });

    const { book, pages } = store.snapshot(result.bookId);
    expect(result.status).toBe(BOOK_STATUS.COMPLETE);
    expect(book.status).toBe(BOOK_STATUS.COMPLETE);
    expect(readablePages(pages)).toHaveLength(4);

    const failed = pages.find((p) => p.page_number === 2);
    expect(failed.text_content).toBeTruthy();
    expect(failed.image_url).toBeFalsy();
    expect(failed.image_prompt.startsWith(IMAGE_FAILED_PREFIX)).toBe(true);
    expect(result.imageFailures.map((f) => f.index)).toEqual([2]);
  });

  it('a page whose TEXT fails leaves a truthful partial book, not a stranded one', async () => {
    const result = await run({
      entities: store,
      ai: makeAi({ failTextAt: [2, 3] }),
      recipe: makeRecipe(4),
    });

    const { book, pages } = store.snapshot(result.bookId);
    expect(result.status).toBe(BOOK_STATUS.PARTIAL);
    expect(book.status).toBe(BOOK_STATUS.PARTIAL);

    const s = summarizeBook(book, pages);
    expect(s.ready).toBe(2);
    expect(s.total).toBe(4);
    expect(s.missingText).toEqual([2, 3]);
    // The parent can open it and read what exists. That is the difference
    // between a half-finished book and "ספר לא נמצא".
    expect(s.isReadable).toBe(true);
  });

  it('marks the book `failed` — never `generating` — when nothing readable was produced', async () => {
    const result = await run({
      entities: store,
      ai: makeAi({ failTextAt: [0, 1, 2, 3] }),
      recipe: makeRecipe(4),
    });
    expect(result.status).toBe(BOOK_STATUS.FAILED);
    expect(store.snapshot(result.bookId).book.status).toBe(BOOK_STATUS.FAILED);
  });

  it('losing the network mid-run still settles the row instead of leaving it `generating`', async () => {
    // Every page write fails — the browser lost its connection after the book
    // row landed. Nothing becomes readable, so the honest answer is `failed`,
    // and critically NOT `generating`, which is what stranded books for a month.
    store.Page.update.mockRejectedValue(new Error('network lost'));

    const result = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(3) });
    expect(result.status).toBe(BOOK_STATUS.FAILED);
    expect(store.snapshot(result.bookId).book.status).toBe(BOOK_STATUS.FAILED);
  });

  it('attaches the book id to an escaping error, so the caller can offer a resume', async () => {
    // A failure outside a page's own try/catch — here the skeleton insert. The
    // error propagates, but the book row it created must not be left claiming
    // work is in progress, and the caller needs its id to offer "continue".
    store.Page.create.mockRejectedValue(new Error('insert rejected'));

    const err = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(3) }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.bookId).toBeTruthy();
    expect(store.snapshot(err.bookId).book.status).toBe(BOOK_STATUS.FAILED);
  });

  it('releases the run lock even when the run throws after acquiring it', async () => {
    const release = vi.fn();
    const lock = vi.fn(() => release);
    store.Page.create.mockRejectedValue(new Error('insert rejected'));

    await generateBookIncremental({
      entities: store,
      ai: makeAi(),
      recipe: makeRecipe(3),
      lock,
      fetchReference: noReference,
    }).catch(() => {});

    expect(lock).toHaveBeenCalled();
    expect(release).toHaveBeenCalled();
  });

  it('takes no lock at all when the run dies before a book exists', async () => {
    // Nothing to unlock, and nothing stranded — the outline call is the only
    // work that happens before there is a row to strand.
    const release = vi.fn();
    const lock = vi.fn(() => release);
    const ai = makeAi();
    ai.InvokeLLM.mockRejectedValue(new Error('outline exploded'));

    const err = await generateBookIncremental({
      entities: store,
      ai,
      recipe: makeRecipe(3),
      lock,
      fetchReference: noReference,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(lock).not.toHaveBeenCalled();
    expect(store.Book.create).not.toHaveBeenCalled();
  });
});

describe('generateBookIncremental — resume', () => {
  it('finishes what is missing and does NOT rewrite what already exists', async () => {
    const store = makeStore();

    // First run: pages 2 and 3 never get their text.
    const first = await run({
      entities: store,
      ai: makeAi({ failTextAt: [2, 3] }),
      recipe: makeRecipe(4),
    });
    expect(first.status).toBe(BOOK_STATUS.PARTIAL);

    const before = store.snapshot(first.bookId).pages
      .filter((p) => p.page_number < 2)
      .map((p) => p.text_content);

    // Second run: the same book, a healthy AI.
    const ai = makeAi();
    const second = await run({
      entities: store,
      ai,
      recipe: makeRecipe(4),
      bookId: first.bookId,
    });

    const { book, pages } = store.snapshot(first.bookId);
    expect(second.status).toBe(BOOK_STATUS.COMPLETE);
    expect(book.status).toBe(BOOK_STATUS.COMPLETE);
    expect(pages).toHaveLength(4); // resumed in place — no duplicate rows

    // The story the parent was already reading is untouched.
    const after = pages.filter((p) => p.page_number < 2).map((p) => p.text_content);
    expect(after).toEqual(before);

    // And it did not pay Gemini again for those pages.
    const textPrompts = ai.InvokeLLM.mock.calls.map((c) => c[0].prompt);
    expect(textPrompts.some((p) => p.startsWith('page 0'))).toBe(false);
    expect(textPrompts.some((p) => p.startsWith('page 1'))).toBe(false);
    expect(textPrompts.filter((p) => p.startsWith('page 2') || p.startsWith('page 3'))).toHaveLength(2);
  });

  it('retries only the missing illustration on resume', async () => {
    const store = makeStore();
    const first = await run({ entities: store, ai: makeAi({ failImageAt: [1] }), recipe: makeRecipe(3) });

    const ai = makeAi();
    await run({ entities: store, ai, recipe: makeRecipe(3), bookId: first.bookId });

    const drawn = ai.GenerateImage.mock.calls.map((c) => c[0].prompt).filter((p) => p !== 'cover');
    expect(drawn).toEqual(['draw 1']);

    const { pages } = store.snapshot(first.bookId);
    expect(pages.every((p) => p.image_url)).toBe(true);
  });

  it('does not regenerate the cover on resume', async () => {
    const store = makeStore();
    const first = await run({ entities: store, ai: makeAi({ failTextAt: [2] }), recipe: makeRecipe(3) });

    const ai = makeAi();
    await run({
      entities: store,
      ai,
      recipe: makeRecipe(3),
      bookId: first.bookId,
      fetchReference: async () => 'COVER64',
    });

    expect(ai.GenerateImage.mock.calls.some((c) => c[0].prompt === 'cover')).toBe(false);
    expect(store.snapshot(first.bookId).book.cover_image).toBe('http://img/cover.png');
  });

  it('rebuilds page rows that never landed, so a resume can actually finish', async () => {
    // The nastiest half-built shape: the book row exists and claims ten pages,
    // but the skeleton inserts died after three. Only filling in existing rows
    // would leave a book that can never reach `complete` — Continue forever.
    const store = makeStore();
    let created = 0;
    store.Page.create.mockImplementation(async (data) => {
      if (++created > 3) throw new Error('insert rejected');
      return store.impl.pageCreate(data);
    });

    const err = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(6) }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    const bookId = err.bookId;
    expect(store.snapshot(bookId).book.total_pages).toBe(6);
    expect(store.snapshot(bookId).pages).toHaveLength(3);

    // Second run against the same, now-healthy store: it must notice rows 3..5
    // are absent, recreate them, and finish the book.
    store.Page.create.mockImplementation(store.impl.pageCreate);
    const second = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(6), bookId });

    expect(second.status).toBe(BOOK_STATUS.COMPLETE);
    expect(store.snapshot(bookId).pages).toHaveLength(6);
    expect(store.snapshot(bookId).pages.every((p) => p.text_content)).toBe(true);
  });

  it('resuming an already-complete book is a no-op that costs nothing', async () => {
    const store = makeStore();
    const first = await run({ entities: store, ai: makeAi(), recipe: makeRecipe(3) });

    const ai = makeAi();
    const second = await run({ entities: store, ai, recipe: makeRecipe(3), bookId: first.bookId });

    expect(second.status).toBe(BOOK_STATUS.COMPLETE);
    expect(ai.InvokeLLM).not.toHaveBeenCalled();
    expect(ai.GenerateImage).not.toHaveBeenCalled();
  });
});

describe('generateBookIncremental — the outline', () => {
  it('retries once when the outline call fails, because its failure costs a whole book', async () => {
    // Observed live: Gemini ran past its token ceiling and returned JSON that
    // stopped mid-string. Nothing exists yet at that point, so there is nothing
    // to resume — the parent just gets nothing. One retry, not a loop.
    const store = makeStore();
    const ai = makeAi();
    let outlineCalls = 0;
    const healthy = ai.InvokeLLM.getMockImplementation();
    ai.InvokeLLM.mockImplementation(async (args) => {
      if (args.prompt === 'outline' && ++outlineCalls === 1) {
        throw new Error("The model's answer was cut off before it finished.");
      }
      return healthy(args);
    });

    const result = await run({ entities: store, ai, recipe: makeRecipe(3) });
    expect(outlineCalls).toBe(2);
    expect(result.status).toBe(BOOK_STATUS.COMPLETE);
  });

  it('gives up after the second failure and reports the FIRST error', async () => {
    const store = makeStore();
    const ai = makeAi();
    let outlineCalls = 0;
    ai.InvokeLLM.mockImplementation(async () => {
      outlineCalls++;
      throw new Error(outlineCalls === 1 ? 'the real reason' : 'a later echo');
    });

    const err = await run({ entities: store, ai, recipe: makeRecipe(3) }).catch((e) => e);
    expect(outlineCalls).toBe(2);
    expect(err.message).toBe('the real reason');
    // Nothing was written, so nothing can be stranded.
    expect(store.Book.create).not.toHaveBeenCalled();
  });

  it('pads a short outline so the book is the length the parent asked for', async () => {
    const store = makeStore();
    const ai = makeAi();
    const healthy = ai.InvokeLLM.getMockImplementation();
    ai.InvokeLLM.mockImplementation(async (args) => {
      if (args.prompt === 'outline') {
        return { title: 'קצר', outline: [{ description: 'only one beat' }] };
      }
      return healthy(args);
    });

    const result = await run({ entities: store, ai, recipe: makeRecipe(5) });
    expect(result.total).toBe(5);
    expect(store.snapshot(result.bookId).pages).toHaveLength(5);
  });
});

describe('generateBookIncremental — the cover never blocks page one', () => {
  it('a cover that fails does not stop the book', async () => {
    const store = makeStore();
    const ai = makeAi();
    ai.GenerateImage.mockImplementation(async ({ prompt }) => {
      if (prompt === 'cover') throw new Error('cover blocked by safety filters');
      const index = Number(/draw (\d+)/.exec(prompt)?.[1] ?? -1);
      return { url: `http://img/${index}.png` };
    });

    const result = await run({ entities: store, ai, recipe: makeRecipe(3) });
    expect(result.status).toBe(BOOK_STATUS.COMPLETE);
    expect(store.snapshot(result.bookId).book.cover_image).toBeFalsy();
  });
});
