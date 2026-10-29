import { type RefObject, useLayoutEffect } from "react";

/**
 * The filler's height: the scroller's spare height, and never under 1px. The last sample row's 1px
 * divider is a collapsed border, half in that row and half in the filler, so a shorter filler leaves
 * the table's height a half pixel past a whole number. The scroller rounds that up, and at the end of
 * a scroll the average row would stop half a pixel above the bottom.
 */
export function fillerHeight(scrollerHeight: number, tableHeight: number, current: number): number {
  return Math.max(1, scrollerHeight - (tableHeight - current));
}

/**
 * Sizes the filler row so the table is at least as tall as its scroller, which puts the average row
 * on the bottom edge even with few rows. With many rows the filler is 1px and the average row is
 * pinned by `position: sticky`.
 *
 * Measured, not left to CSS: given a table taller than its rows, browsers disagree on where the
 * extra height goes (Chrome shares it with the sample rows, Firefox gives it to the header when
 * the body is empty).
 *
 * `rowCount` re-runs it when rows come and go. Resizes are caught by observing the scroller and the
 * table; setting the filler resizes the table once more, which computes the same height and stops.
 */
export function useFillerHeight(
  scrollerRef: RefObject<HTMLElement | null>,
  fillerRef: RefObject<HTMLElement | null>,
  rowCount: number,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `rowCount` is the intended trigger — the filler mounts with the first row and the table changes height with each row.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const filler = fillerRef.current;
    const table = scroller?.querySelector("table");
    if (!scroller || !filler || !table) return;

    const sync = () => {
      const h = fillerHeight(
        scroller.clientHeight,
        table.getBoundingClientRect().height,
        filler.getBoundingClientRect().height,
      );
      filler.style.height = `${h}px`;
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(scroller);
    observer.observe(table);
    return () => observer.disconnect();
  }, [scrollerRef, fillerRef, rowCount]);
}
