import { type RefObject, useEffect, useState } from "react";

/**
 * The scale at which an element of `contentWidth` px fits inside `ref`'s current width — capped at
 * 1, so "fit" never magnifies a sim beyond its real size (that would be a lie about the layout).
 *
 * Recomputed on window resize. Returns 1 until the element has a measurable width, which covers both
 * the first render and jsdom (where layout is never computed).
 */
export function useFitScale(
  ref: RefObject<HTMLElement | null>,
  contentWidth: number,
  enabled: boolean,
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!enabled) {
      setScale(1);
      return;
    }

    const measure = () => {
      const available = ref.current?.clientWidth ?? 0;
      // clientWidth is 0 before layout (and always, in jsdom) — treat that as "no constraint known".
      setScale(available > 0 ? Math.min(1, available / contentWidth) : 1);
    };

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref, contentWidth, enabled]);

  return scale;
}
