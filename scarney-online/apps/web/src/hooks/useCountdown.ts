import { useState, useEffect, useRef } from 'react';

/**
 * Returns seconds remaining until `targetEpochMs`.
 * Ticks every second. Returns 0 once expired.
 */
export function useCountdown(targetEpochMs: number, totalSeconds: number): {
  remaining: number;
  pct: number;
} {
  const [remaining, setRemaining] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, targetEpochMs - Date.now());
      setRemaining(Math.ceil(diff / 1000));
      if (diff > 0) {
        rafRef.current = window.setTimeout(tick, 250);
      }
    };
    tick();
    return () => {
      if (rafRef.current !== null) clearTimeout(rafRef.current);
    };
  }, [targetEpochMs]);

  const pct = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;

  return { remaining, pct };
}
