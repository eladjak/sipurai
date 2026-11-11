import { useEffect, useMemo, useState } from 'react';
import { Book } from '@/entities/Book';
import { Page } from '@/entities/Page';
import { PublicBook, PublicPage } from '@/entities/PublicBook';
import { readablePages, viewState } from '@/lib/bookProgress';
import { isRunLive } from '@/lib/generationLock';

export function useNightReader(id) {
  const [book, setBook] = useState(null), [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    let active = true, timer;
    async function load(first) {
      try {
        let b; try { b = await Book.get(id); } catch { /* public fallback */ }
        if (!b) b = await PublicBook.get(id);
        let p; try { p = await Page.filter({ book_id: id }, 'page_number'); } catch { p = await PublicPage.filter({ book_id: id }, 'page_number'); }
        if (!active) return;
        const list = Array.isArray(p) ? p : [];
        setBook(b); setRows(list); setFailed(!b);
        if (first) {
          try { const saved = Number(localStorage.getItem(`book_${id}_page`)); if (Number.isInteger(saved) && saved >= 0 && saved < readablePages(list).length) setIndex(saved); } catch { /* storage unavailable */ }
        }
      } catch { if (active && first) setFailed(true); }
      finally { if (active) setLoading(false); }
    }
    load(true); timer = setInterval(() => { if (isRunLive(id)) load(false); }, 4000);
    return () => { active = false; clearInterval(timer); };
  }, [id]);
  const pages = useMemo(() => readablePages(rows), [rows]);
  useEffect(() => { if (pages.length && index >= pages.length) setIndex(pages.length - 1); }, [pages.length, index]);
  useEffect(() => { if (pages.length) try { localStorage.setItem(`book_${id}_page`, String(index)); } catch { /* storage unavailable */ } }, [id, index, pages.length]);
  const state = loading ? 'loading' : failed ? 'failed' : viewState(book, rows, isRunLive(id));
  return { book, pages, index, setIndex, state };
}
