import { useEffect, useRef, useState } from 'react';
import { Page } from '@/entities/Page';
import { readablePages } from '@/lib/bookProgress';

export function useTheatre(bookId, state) {
  const [pages, setPages] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const started = useRef(performance.now());
  const measured = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    if (!bookId) return undefined;
    let alive = true;
    async function load() {
      const before = revision.current;
      try {
        const rows = await Page.filter({ book_id: bookId }, 'page_number');
        if (!alive || before !== revision.current) return;
        const ready = readablePages(rows);
        setPages(ready); setLoadError(false);
        if (ready.length && !measured.current) {
          measured.current = true;
          if (import.meta.env.DEV) console.debug('[writing-theatre] time to first page:', Math.round(performance.now() - started.current), 'ms');
        }
      } catch { if (alive) setLoadError(true); }
    }
    load();
    const timer = setInterval(load, 4000);
    return () => { alive = false; clearInterval(timer); };
  }, [bookId, state]);
  async function save(page, text) {
    await Page.update(page.id, { text_content: text });
    revision.current++;
    setPages(current => current.map(p => p.id === page.id ? { ...p, text_content: text } : p));
  }
  return { pages, loadError, save };
}
