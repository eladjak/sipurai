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
    getVisitorCountry().then((c) => { if (live) setCountry(c); });
    return () => { live = false; };
  }, []);
  return country;
}
