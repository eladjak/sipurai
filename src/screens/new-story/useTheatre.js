import { useEffect, useRef, useState } from 'react';
import { Page } from '@/entities/Page';
import { Book } from '@/entities/Book';
import { readablePages, summarizeBook } from '@/lib/bookProgress';

export function useTheatre(bookId, state) {
  const [pages, setPages] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [bookStatus, setBookStatus] = useState(null);
  const started = useRef(performance.now());
  const measured = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    if (!bookId) return undefined;
    let alive = true;
    let timer;
    const final = state === 'success' || state === 'failed';
    async function load() {
      const before = revision.current;
      let loaded = false;
      try {
        const [rows, book] = await Promise.all([Page.filter({ book_id: bookId }, 'page_number'), Book.get(bookId).catch(() => null)]);
        if (!alive || before !== revision.current) return;
        const ready = readablePages(rows);
        const summary = summarizeBook(book, rows);
        const incomplete = final && ready.length > 0 && summary.total > ready.length;
        loaded = true;
        setPages(ready); setBookStatus(incomplete ? 'partial' : book?.status || null); setLoadError(false);
        if (ready.length && !measured.current) {
          measured.current = true;
          if (import.meta.env.DEV) console.debug('[writing-theatre] time to first page:', Math.round(performance.now() - started.current), 'ms');
        }
      } catch { if (alive) setLoadError(true); }
      finally { if (alive && (!final || !loaded || before !== revision.current)) timer = setTimeout(load, 4000); }
    }
    load();
    return () => { alive = false; clearTimeout(timer); };
  }, [bookId, state]);
  async function save(page, text) {
    await Page.update(page.id, { text_content: text });
    revision.current++;
    setPages(current => current.map(p => p.id === page.id ? { ...p, text_content: text } : p));
  }
  return { pages, loadError, save, bookStatus };
}
