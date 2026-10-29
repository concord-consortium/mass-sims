import { prefersReducedMotion, smoothScrollIntoView } from "@concord-consortium/mass-sims-shared";
import { type RefObject, useLayoutEffect, useRef } from "react";

const SLIDE: KeyframeAnimationOptions = { duration: 240, easing: "ease" };

/** How far each row moved: rows with no earlier position, or that did not move, are left out. */
export function flipDeltas(
  before: ReadonlyMap<string, number>,
  after: ReadonlyMap<string, number>,
): { id: string; dy: number }[] {
  const out: { id: string; dy: number }[] = [];
  for (const [id, top] of after) {
    const was = before.get(id);
    if (was === undefined) continue;
    const dy = was - top;
    if (dy !== 0) out.push({ id, dy });
  }
  return out;
}

/** Each row's top edge in the scroller's content coordinates, keyed by `data-row-key`. */
function rowTops(tbody: HTMLElement, scroller: HTMLElement): Map<string, number> {
  const top = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const tops = new Map<string, number>();
  for (const tr of tbody.querySelectorAll<HTMLElement>("tr[data-row-key]")) {
    tops.set(tr.dataset.rowKey as string, tr.getBoundingClientRect().top - top);
  }
  return tops;
}

/**
 * After each render that changes the displayed rows: scrolls a just-taken sample into view, then
 * slides every row that moved from its old seat to its new one (a sort, a delete, or a sample
 * landing mid-list under a sort).
 *
 * The old seats are recorded after the previous render, in content coordinates, so a row that only
 * moved because the scroller scrolled does not count as moved. This runs before paint, so the rows
 * are never seen in their new seats un-animated. Nothing animates on a trial switch (every row is
 * new then), and nothing animates or scrolls smoothly under reduced motion.
 *
 * The slides use `element.animate()`, not CSS transitions: to reorder rows React takes some out of
 * the table and puts them back, which cancels a running CSS transition but not a script animation.
 * So a slide still running when the next change lands can be measured and carried on.
 */
export function useRowFlip(
  tbodyRef: RefObject<HTMLTableSectionElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  letter: string,
  rowKeys: readonly string[],
) {
  const last = useRef<{ letter: string; tops: Map<string, number> } | null>(null);
  const order = rowKeys.join(",");

  // biome-ignore lint/correctness/useExhaustiveDependencies: `order` (the displayed row keys) is the intended trigger; `rowKeys` is read through it.
  useLayoutEffect(() => {
    const tbody = tbodyRef.current;
    const scroller = scrollerRef.current;
    if (!tbody || !scroller) return;
    const before = last.current?.letter === letter ? last.current.tops : null;

    // A sample was just taken: exactly one new row. A restore or a trial switch adds others.
    if (before) {
      const added = rowKeys.filter((k) => !before.has(k));
      if (added.length === 1 && rowKeys.length === before.size + 1) {
        const row = tbody.querySelector(`tr[data-row-key="${added[0]}"]`);
        if (row) smoothScrollIntoView(row);
      }
    }

    // A slide still running from the last change is part of where a row is shown, but not of its
    // seat. Measure the rows as shown, stop the running slides, then measure the seats, so the
    // saved seats are clean and an interrupted row carries on from where it is shown.
    const shown = rowTops(tbody, scroller);
    for (const tr of tbody.querySelectorAll<HTMLElement>("tr[data-row-key]")) {
      for (const animation of tr.getAnimations()) animation.cancel();
    }
    const after = rowTops(tbody, scroller);
    last.current = { letter, tops: after };
    if (!before || prefersReducedMotion()) return;

    const from = new Map<string, number>();
    for (const [id, top] of before) {
      from.set(id, top + (shown.get(id) ?? 0) - (after.get(id) ?? 0));
    }
    for (const { id, dy } of flipDeltas(from, after)) {
      const tr = tbody.querySelector<HTMLElement>(`tr[data-row-key="${id}"]`) as HTMLElement;
      tr.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], SLIDE);
    }
  }, [tbodyRef, scrollerRef, letter, order]);
}
