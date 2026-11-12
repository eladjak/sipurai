import { useEffect, useState } from 'react';
import { cachedVisitorCountry, getVisitorCountry } from '@/lib/visitorCountry';

/** Returns the visitor's country code, or '' while loading / when unknown. */
export default function useVisitorCountry() {
  const [country, setCountry] = useState(() => cachedVisitorCountry() || '');
  useEffect(() => {
    let live = true;
    getVisitorCountry().then((c) => { if (live) setCountry(c); });
    return () => { live = false; };
  }, []);
  return country;
}
