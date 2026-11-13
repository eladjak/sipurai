import { useEffect, useState } from 'react';
import { getVisitorCountry } from '@/lib/visitorCountry';

/**
 * The visitor's country code. null = still asking the server (show no price yet),
 * '' = unknown (callers fall back to language/time zone), 'IL', 'US', ... otherwise.
 */
export default function useVisitorCountry() {
  const [country, setCountry] = useState(null);
  useEffect(() => {
    let live = true;
    const ask = () => getVisitorCountry().then((c) => { if (live) setCountry(c); });
    ask();
    // Ask again when the visitor comes back to the tab (travel, new network).
    // Back to 'loading' first, so an old answer (e.g. dollars from abroad) is never shown meanwhile.
    const onVisible = () => { if (document.visibilityState === 'visible') { setCountry(null); ask(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { live = false; document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return country;
}
