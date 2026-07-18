import { useEffect, useRef, useState } from 'react';

/**
 * wow-ui-standard count-up (principle 13).
 *
 * Animates a number from 0 up to its final value once, when `active` becomes
 * true (typically on viewport entry). On completion it restores the EXACT
 * final value passed in — it never leaves behind a re-rounded/re-formatted
 * value. Under prefers-reduced-motion the animation is skipped entirely and
 * the final value is shown immediately.
 *
 * Framework-agnostic to the app's formatting: the caller formats the returned
 * numeric `value`. Pass the same formatter you use for the resting display so
 * the byte-identical final string is what the user is left with.
 *
 * @param {number} end       final numeric value
 * @param {boolean} active   start the animation when this flips to true
 * @param {object} [opts]
 * @param {number} [opts.duration=1200]  animation length in ms
 * @returns {number} current value to display (formatted by the caller)
 */
export function useCountUp(end, active, { duration = 1200 } = {}) {
  const target = Number.isFinite(end) ? end : 0;
  const [value, setValue] = useState(target); // base state = final value (no-JS / RM safe)
  const rafRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    // Reduced-motion belt (JS, triple-belt layer 2): skip the animation.
    const prefersReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || target === 0 || startedRef.current) {
      setValue(target);
      return;
    }

    startedRef.current = true;
    const startTime = performance.now();
    setValue(0);

    const tick = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      if (t >= 1) {
        setValue(target); // restore exact final value
        return;
      }
      setValue(Math.round(target * eased));
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, duration]);

  // If the target changes after settling (live data refresh), yield to it
  // immediately rather than overwriting with a stale animated string.
  useEffect(() => {
    if (startedRef.current) setValue(target);
  }, [target]);

  return value;
}

export default useCountUp;
