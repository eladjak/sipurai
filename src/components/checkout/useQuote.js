import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads the server quote for (bookId, qty, method). Debounced, and a late answer for
 * an older selection is ignored. The UI shows prices from this quote only.
 */
export function useQuote(api, { bookId, qty, method, paper, enabled = true, debounceMs = 250 }) {
  const [state, setState] = useState({ status: 'idle', quote: null, error: null });
  const seq = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled || !bookId) return undefined;
    const my = ++seq.current;
    setState((s) => ({ status: 'loading', quote: null, error: null }));
    const timer = setTimeout(async () => {
      try {
        const quote = await api.getQuote({ bookId, qty, method, paper });
        if (my === seq.current) setState({ status: 'ready', quote, error: null });
      } catch (error) {
        if (my === seq.current) setState({ status: 'error', quote: null, error });
      }
    }, debounceMs);
    return () => { clearTimeout(timer); if (seq.current === my) seq.current += 1; };
  }, [api, bookId, qty, method, paper, enabled, debounceMs, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, retry };
}
