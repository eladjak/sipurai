import { useCallback, useEffect, useState } from 'react';
import { Book } from '@/entities/Book';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useShelf() {
  const { user } = useCurrentUser();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    const online = () => { setOffline(false); retry(); };
    const disconnected = () => setOffline(true);
    window.addEventListener('online', online); window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, [retry]);
  useEffect(() => {
    let active = true;
    if (!user?.id || offline) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError(false);
    Book.filter({ created_by: user.id }).then(result => { if (active) setBooks(result); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, offline, attempt]);
  return { books, loading, error, offline, retry };
}
