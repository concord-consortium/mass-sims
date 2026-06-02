import { useEffect, useRef } from "react";

/**
 * Returns a tuple of the current value and the value from the previous render.
 *
 * On the first render, `previous` is `undefined`. On subsequent renders, `previous` reflects
 * whatever `value` was the *last* time this hook ran.
 *
 * Typical use is change-detection in an effect:
 *
 *   const [count, prevCount] = useCurrentAndPrevious(count);
 *   useEffect(() => {
 *     if (prevCount !== undefined && count > prevCount) {
 *       // count just increased
 *     }
 *   }, [count, prevCount]);
 *
 * Combines DESE's separate `use-current` and `use-previous` hooks into one place.
 */
export function useCurrentAndPrevious<T>(value: T): readonly [current: T, previous: T | undefined] {
  const previousRef = useRef<T | undefined>(undefined);

  // Capture the just-rendered value *after* commit so that the next render sees it as "previous."
  useEffect(() => {
    previousRef.current = value;
  }, [value]);

  return [value, previousRef.current] as const;
}
