import { useCallback, useEffect, useState } from 'react';
import { Book } from '@/entities/Book';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useShelf(enabled = true) {
  const { user } = useCurrentUser();
  const owner = enabled ? user?.id : undefined;
  const [snapshot, setSnapshot] = useState({ owner: null, books: [] });
  const books = snapshot.owner === owner ? snapshot.books : [];
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
    if (!owner || offline) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError(false);
    Book.filter({ created_by: owner }).then(result => { if (active) setSnapshot({ owner, books: Array.isArray(result) ? result : [] }); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, offline, attempt]);
  return { books, loading: loading || (!!owner && !offline && snapshot.owner !== owner && !error), error, offline, retry };
}
