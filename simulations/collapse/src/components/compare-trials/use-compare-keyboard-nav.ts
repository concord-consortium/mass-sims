import { type RefObject, useEffect, useRef } from "react";
import { focusInGrid, useKeyboardModality } from "../data-table/keyboard-focus";

const SORT = ".collapse-th-sort";
const COLUMN = ".collapse-compare-col";
const ROWS = "tbody.collapse-rows > tr";

/**
 * The Compare Trials view's keyboard paths, on top of Tab. Each column has one tab stop in its
 * rows, its first row (`CompareRow`'s `tabIndex`), so leaving a column and coming back starts at
 * the top. All twelve headings are tab stops.
 *
 * - On a row, ArrowUp / ArrowDown / Home / End move within the column. ArrowUp from the first row
 *   goes to the heading the student came down through, if it is in this column, else the column's
 *   first heading.
 * - On a row, ArrowLeft / ArrowRight move straight across, to the same row position in the next
 *   column that has rows, never by year. The position is kept as a goal row, so crossing a short
 *   column does not lose it.
 * - On a heading, ArrowLeft / ArrowRight move through all twelve headings in order, and ArrowDown
 *   enters the column's first row.
 *
 * A row focused with the keyboard links its year in every column (`onLinkYear`), as hovering it
 * does.
 */
export function useCompareKeyboardNav(
  gridRef: RefObject<HTMLElement | null>,
  onLinkYear: (years: number | null) => void,
) {
  const kbNav = useKeyboardModality(gridRef);
  const lastHead = useRef<HTMLElement | null>(null);
  const goal = useRef(0);
  const crossing = useRef(false);
  const onLinkYearRef = useRef(onLinkYear);
  onLinkYearRef.current = onLinkYear;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const focusRow = (row: HTMLElement) => focusInGrid(row, kbNav.current, grid);
    const columns = () => Array.from(grid.querySelectorAll<HTMLElement>(COLUMN));
    const rowsOf = (column: Element) => Array.from(column.querySelectorAll<HTMLElement>(ROWS));
    const isRow = (el: Element | null) => !!el?.matches(ROWS);

    const onRowKey = (e: KeyboardEvent, row: HTMLElement) => {
      const column = row.closest(COLUMN);
      if (!column) return;
      const rows = rowsOf(column);
      const i = rows.indexOf(row);

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const cols = columns();
        const step = e.key === "ArrowRight" ? 1 : -1;
        for (
          let c = cols.indexOf(column as HTMLElement) + step;
          c >= 0 && c < cols.length;
          c += step
        ) {
          const next = rowsOf(cols[c]);
          if (next.length > 0) {
            crossing.current = true;
            focusRow(next[Math.min(goal.current, next.length - 1)]);
            crossing.current = false;
            return;
          }
        }
        return;
      }
      if (e.key === "ArrowUp" && i === 0) {
        e.preventDefault();
        const head =
          lastHead.current?.isConnected && column.contains(lastHead.current)
            ? lastHead.current
            : column.querySelector<HTMLElement>(SORT);
        head?.focus();
        return;
      }
      const to =
        e.key === "ArrowDown"
          ? Math.min(i + 1, rows.length - 1)
          : e.key === "ArrowUp"
            ? i - 1
            : e.key === "Home"
              ? 0
              : e.key === "End"
                ? rows.length - 1
                : null;
      if (to === null) return;
      e.preventDefault();
      goal.current = to;
      focusRow(rows[to]);
    };

    const onHeadKey = (e: KeyboardEvent, head: HTMLElement) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const heads = Array.from(grid.querySelectorAll<HTMLElement>(SORT));
        heads[heads.indexOf(head) + (e.key === "ArrowRight" ? 1 : -1)]?.focus();
        return;
      }
      if (e.key !== "ArrowDown") return;
      const first = rowsOf(head.closest(COLUMN) ?? grid)[0];
      if (!first) return;
      e.preventDefault();
      lastHead.current = head;
      goal.current = 0;
      focusRow(first);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (isRow(target)) onRowKey(e, target);
      else if (target.matches(SORT)) onHeadKey(e, target);
    };

    // A row reached any way but a sideways move (Tab, a click) becomes the goal for sideways moves.
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (!isRow(target)) return;
      const column = target.closest(COLUMN);
      if (column && !crossing.current) goal.current = rowsOf(column).indexOf(target);
      // Not after a click: the highlight would stay on that year after the pointer left the row.
      onLinkYearRef.current(kbNav.current ? Number(target.dataset.year) : null);
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!isRow(e.relatedTarget as Element | null)) onLinkYearRef.current(null);
    };

    grid.addEventListener("keydown", onKeyDown);
    grid.addEventListener("focusin", onFocusIn);
    grid.addEventListener("focusout", onFocusOut);
    return () => {
      grid.removeEventListener("keydown", onKeyDown);
      grid.removeEventListener("focusin", onFocusIn);
      grid.removeEventListener("focusout", onFocusOut);
    };
  }, [gridRef, kbNav]);
}
