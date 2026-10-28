import { prefersReducedMotion, smoothScrollIntoView } from "@concord-consortium/mass-sims-shared";
import { type RefObject, useLayoutEffect, useRef } from "react";

const MOVE = "transform 240ms ease";

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

    // Content coordinates, so the scroll just started does not count as a move.
    const after = rowTops(tbody, scroller);
    last.current = { letter, tops: after };
    if (!before || prefersReducedMotion()) return;

    const moves = flipDeltas(before, after);
    const rows = moves.map(({ id, dy }) => {
      const tr = tbody.querySelector<HTMLElement>(`tr[data-row-key="${id}"]`) as HTMLElement;
      tr.style.transition = "none";
      tr.style.transform = `translateY(${dy}px)`;
      return tr;
    });
    if (rows.length === 0) return;
    // Flush, so the old seats are applied before the transition starts. A frame alone can let both
    // writes land in the same style pass.
    void tbody.offsetHeight;
    for (const tr of rows) {
      tr.style.transition = MOVE;
      tr.style.transform = "";
    }
  }, [tbodyRef, scrollerRef, letter, order]);
}
