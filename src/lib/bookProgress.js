/**
 * Book progress — the single place that decides what a half-built book *is*.
 *
 * Generation is incremental: a book row is written before any of its pages
 * exist, page rows are written before their text exists, and text is written
 * before its illustration exists. Every one of those intermediate shapes is a
 * legitimate state a reader can encounter, so every surface that shows a book
 * has to agree on how to read them. This module is that agreement.
 *
 * The rule that makes it safe: **the pages are the truth, `books.status` is a
 * cached summary of them.** Anything that can be derived from the page rows is
 * derived here rather than trusted from the column, because the column is
 * written by a process that can die between two statements and the rows cannot
 * disagree with themselves.
 *
 * Pure functions only — no network, no React, no storage. That is what makes
 * the state machine testable without mocking the thing under test.
 */

/** Values persisted in `books.status` (a plain text column — no CHECK constraint). */
export const BOOK_STATUS = {
  /** A run is planned or in flight and fewer than every page is written. */
  GENERATING: 'generating',
  /** A run stopped with at least one readable page. Resumable. */
  PARTIAL: 'partial',
  /** Every planned page has text. */
  COMPLETE: 'complete',
  /** A run stopped with nothing readable at all. Resumable (from scratch). */
  FAILED: 'failed',
};

const RESUMABLE = new Set([BOOK_STATUS.GENERATING, BOOK_STATUS.PARTIAL, BOOK_STATUS.FAILED]);

/**
 * A page is *readable* when it has text. Skeleton rows are written up front to
 * persist the outline (that is what makes a run resumable from any device), so
 * "a row exists" and "a child can read it" are different claims and only the
 * second one may reach the reader.
 */
export function isPageReady(page) {
  return !!(page && typeof page.text_content === 'string' && page.text_content.trim().length > 0);
}

/** A readable page whose illustration also landed. */
export function isPageIllustrated(page) {
  return isPageReady(page) && !!(page.image_url && String(page.image_url).trim());
}

/**
 * Order by page_number and collapse duplicates.
 *
 * `pages` has no unique index on (book_id, page_number) — see
 * docs/INCREMENTAL-GENERATION.md, "Schema decisions" — so two concurrent runs
 * of the same book could each insert a row for the same page. Rather than
 * render the duplicate, prefer the more complete of the two. Deduping on read
 * means a race degrades to a wasted row, never to a wrong book.
 */
export function normalizePages(pages) {
  const list = Array.isArray(pages) ? pages.filter(Boolean) : [];
  const byNumber = new Map();
  for (const page of list) {
    const key = Number.isFinite(page.page_number) ? page.page_number : -1;
    const existing = byNumber.get(key);
    if (!existing || score(page) > score(existing)) byNumber.set(key, page);
  }
  return [...byNumber.values()].sort((a, b) => (a.page_number ?? 0) - (b.page_number ?? 0));
}

function score(page) {
  return (isPageReady(page) ? 2 : 0) + (isPageIllustrated(page) ? 1 : 0);
}

/** The pages a reader may actually be shown, in order. */
export function readablePages(pages) {
  return normalizePages(pages).filter(isPageReady);
}

/**
 * Everything a surface needs to tell the truth about a book in one object.
 *
 * `total` is the *planned* page count. It comes from `books.total_pages`, which
 * the generator sets from the outline before it writes a single page — so a
 * book that dies after two pages still knows it was meant to have ten, and the
 * reader can say "2 of 10" instead of pretending two was the plan.
 */
export function summarizeBook(book, pages) {
  const ordered = normalizePages(pages);
  const ready = ordered.filter(isPageReady);
  const planned = Number(book?.total_pages);
  const total = Number.isFinite(planned) && planned > 0 ? Math.max(planned, ordered.length) : ordered.length;

  return {
    total,
    ready: ready.length,
    illustrated: ordered.filter(isPageIllustrated).length,
    /** Planned pages with no text yet — the work a resume has to do. */
    missingText: ordered.filter((p) => !isPageReady(p)).map((p) => p.page_number),
    /** Readable pages whose illustration failed or never ran. */
    missingImage: ready.filter((p) => !isPageIllustrated(p)).map((p) => p.page_number),
    hasSkeleton: ordered.length > 0,
    isComplete: total > 0 && ready.length >= total,
    isReadable: ready.length > 0,
  };
}

/**
 * What `books.status` *should* say, given the rows that actually exist.
 *
 * Used both by the generator (to write the column) and by the reader (to notice
 * when the column disagrees with the pages, which is exactly what happens when
 * a tab is closed mid-run). A status is never invented here — it is read off
 * the data.
 */
export function deriveStatus(book, pages) {
  const s = summarizeBook(book, pages);
  if (s.isComplete) return BOOK_STATUS.COMPLETE;
  if (s.isReadable) return BOOK_STATUS.PARTIAL;
  return BOOK_STATUS.FAILED;
}

/**
 * Can a "continue building this" action do anything useful?
 *
 * Note the second clause. A book whose every page has words but whose
 * illustrations all failed is `complete` — completeness is about text, because
 * text is what makes a page readable — and yet there is real work left. Without
 * this, a picture book with no pictures would present itself as finished and
 * offer no way to fix itself, which is the same silence this redesign exists to
 * remove, just one layer down.
 */
export function isResumable(book, pages) {
  if (!book) return false;
  if (!RESUMABLE.has(book.status) && book.status !== BOOK_STATUS.COMPLETE) return false;
  const s = summarizeBook(book, pages);
  return !s.isComplete || s.missingImage.length > 0;
}

/**
 * The state a *viewer* should be shown. Deliberately not the raw column: a book
 * stuck at `generating` because its tab was closed is presented as interrupted,
 * not as forever-loading, unless a live run is actually holding the lock.
 *
 * @param {object|null} book
 * @param {Array} pages
 * @param {boolean} isRunLive  a generation run is currently heartbeating
 */
export function viewState(book, pages, isRunLive = false) {
  if (!book) return 'missing';
  const s = summarizeBook(book, pages);
  if (s.isComplete) return 'complete';
  if (isRunLive) return s.isReadable ? 'building' : 'starting';
  if (s.isReadable) return 'interrupted';
  return 'empty';
}
