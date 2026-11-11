import { useCallback, useEffect, useState } from 'react';
import { Character } from '@/entities/Character';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useHeroes() {
  const { user } = useCurrentUser();
  const [heroes, setHeroes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(n => n + 1), []);
  useEffect(() => {
    const online = () => { setOffline(false); retry(); };
    const off = () => setOffline(true);
    window.addEventListener('online', online); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', off); };
  }, [retry]);
  useEffect(() => {
    let active = true;
    if (!user?.id || offline) { setLoading(false); return () => { active = false; }; }
    setLoading(true); setError(false);
    Character.list('-created_date').then(items => { if (active) setHeroes(items.filter(item => item.created_by === user.id)); }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id, offline, attempt]);
  return { heroes, loading, error, offline, retry };
}
