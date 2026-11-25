import { useEffect, useMemo, useState } from 'react';
import { Page } from '@/entities/Page';
import { readablePages, summarizeBook } from '@/lib/bookProgress';
import { readSavedReaderPosition } from '@/lib/readerPosition';
import { useShelf } from '@/screens/shelf/useShelf';

function savedIndex(id) {
  try {
    const value = localStorage.getItem(`book_${id}_page`);
    return value && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  } catch {
    return null;
  }
}

export function useHomeBooks(identityReady) {
  const shelf = useShelf(identityReady);
  const ready = identityReady && !shelf.loading && !shelf.error && !shelf.offline;
  const books = useMemo(() => ready ? [...shelf.books].sort((a, b) =>
    (b.created_date || '').localeCompare(a.created_date || '')) : [], [ready, shelf.books]);
  const completed = books.filter(book => book.status === 'complete');
  const featured = completed[0] || books.find(book => book.status === 'partial');
  const moreBooks = completed.slice(1, 3);
  const inProgress = books.filter(book => book !== featured && book.status !== 'complete').slice(0, 3);
  const partialIds = JSON.stringify(inProgress.filter(book => book.status === 'partial').map(book => book.id));
  const featuredId = featured?.id;
  const bookmark = featuredId ? savedIndex(featuredId) : null;
  const inspectFeatured = Boolean(featuredId && (featured.status === 'partial' || bookmark !== null));
  const [inspection, setInspection] = useState(null);

  useEffect(() => {
    if (!ready) {
      setInspection(null);
      return;
    }
    const ids = JSON.parse(partialIds);
    if (inspectFeatured) ids.push(featuredId);
    let active = true;
    for (const id of ids) {
      Page.filter({ book_id: id }, 'page_number').then(rows => {
        if (active) setInspection(previous => ({
          ...previous,
          [id]: { snapshot: books, rows },
        }));
      }).catch(() => { /* Keep generic reader/recovery links if page details fail. */ });
    }
    return () => { active = false; };
  }, [ready, books, partialIds, featuredId, inspectFeatured]);

  const details = book => {
    const record = inspection?.[book.id];
    if (!record || record.snapshot !== books) return null;
    const summary = summarizeBook(book, record.rows);
    let page = null;
    if (book === featured && bookmark !== null) {
      const pages = readablePages(record.rows);
      try {
        const folio = readSavedReaderPosition(localStorage, book.id, pages);
        if (pages.some(row => row.page_number === folio)) page = folio;
      } catch {
        // Keep the generic reading link when browser storage is unavailable.
      }
    }
    return { ...summary, page };
  };

  return { ...shelf, loading: !identityReady || shelf.loading, featured, moreBooks, inProgress, details, empty: ready && books.length === 0 };
}
