import { useShelf } from '@/screens/shelf/useShelf';

export function useTonight() {
  const shelf = useShelf();
  const readable = shelf.books.filter(book => book.status === 'complete' || book.status === 'partial')
    .sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  let page = null;
  if (readable[0]) {
    try {
      const saved = localStorage.getItem(`book_${readable[0].id}_page`);
      if (saved !== null && /^\d+$/.test(saved) && Number(saved) > 0) page = Number(saved);
    } catch { /* storage may be unavailable */ }
  }
  return { ...shelf, readable, page };
}
