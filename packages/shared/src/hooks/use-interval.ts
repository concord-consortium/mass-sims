import { useEffect, useRef } from "react";

/**
 * Declarative `setInterval` hook. Pattern adapted from Dan Abramov's
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/.
 *
 * - Updating `callback` does NOT restart the interval; the timer always calls the latest
 *   callback via a ref.
 * - Updating `delay` restarts the interval at the new cadence.
 * - Passing `null` for `delay` pauses the timer; passing a number resumes it.
 */
export function useInterval(callback: () => unknown, delay: number | null): void {
  const callbackRef = useRef(callback);

  // Keep the ref pointed at the latest callback on every render.
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Set up (or tear down) the interval whenever `delay` changes.
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => {
      callbackRef.current();
    }, delay);
    return () => {
      clearInterval(id);
    };
  }, [delay]);
}
