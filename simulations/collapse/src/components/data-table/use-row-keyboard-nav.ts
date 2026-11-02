import { type RefObject, useEffect, useLayoutEffect, useRef } from "react";
import { focusInGrid as focusIn, useKeyboardModality } from "./keyboard-focus";

const SORT = ".collapse-th-sort";
const DEL = ".collapse-row-del";
const NAV_KEYS = new Set(["ArrowUp", "ArrowDown", "Home", "End", "ArrowLeft", "ArrowRight"]);

/**
 * The table's keyboard fast path and its focus ring. Every row and delete button stays in the
 * normal Tab order; the arrows are a shortcut on top:
 *
 * - ArrowUp / ArrowDown / Home / End move between rows, staying in the delete column when on a
 *   delete button. ArrowUp from the top row goes to the heading the student came down through, or
 *   the first heading.
 * - ArrowRight on a row goes to its delete button; ArrowLeft comes back.
 * - On a heading, ArrowLeft / ArrowRight move between headings and ArrowDown enters the rows at
 *   the top.
 *
 * The keyboard ring is `useKeyboardModality`'s.
 *
 * `rememberFocus()` is called just before a delete. After the rows change, focus goes back to the
 * same row position (or its delete button), clamped to the last row, or to the first heading when
 * no rows remain, so it never falls to the page.
 */
export function useRowKeyboardNav(
  tbodyRef: RefObject<HTMLTableSectionElement | null>,
  headRowRef: RefObject<HTMLTableRowElement | null>,
  scrollerRef: RefObject<HTMLElement | null>,
  rowCount: number,
) {
  const kbNav = useKeyboardModality(tbodyRef);
  const lastHead = useRef<HTMLElement | null>(null);
  const pending = useRef<{ index: number; onDelete: boolean } | null>(null);

  const focusInGrid = (el: HTMLElement) => focusIn(el, kbNav.current, tbodyRef.current);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `focusInGrid` reads only refs, so it need not re-attach the listeners.
  useEffect(() => {
    const tbody = tbodyRef.current;
    const headRow = headRowRef.current;
    const scroller = scrollerRef.current;
    if (!tbody || !headRow || !scroller) return;

    // The browser scrolls by itself when Tab moves focus, and offers no `preventScroll`. So note
    // where the scroller was as focus moves between rows, put it back as focus lands, and scroll
    // the minimum instead. Focus that leaves the rows notes nothing: the scroller may be scrolled
    // by other means before focus comes back.
    let scrollBefore: number | null = null;
    const onFocusOut = (e: FocusEvent) => {
      const staysInRows = tbody.contains(e.relatedTarget as Node | null);
      scrollBefore = staysInRows ? scroller.scrollTop : null;
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (scrollBefore !== null) scroller.scrollTop = scrollBefore;
      scrollBefore = null;
      target.closest("tr")?.scrollIntoView?.({ block: "nearest" });
    };

    const headings = () => Array.from(headRow.querySelectorAll<HTMLElement>(SORT));

    const onRowKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !NAV_KEYS.has(e.key)) return;
      const target = e.target as HTMLElement;
      const rows = Array.from(tbody.children) as HTMLElement[];
      const row = target.closest("tr");
      const i = row ? rows.indexOf(row) : -1;
      if (!row || i === -1) return;
      e.preventDefault();
      const onDelete = target !== row;

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const del = row.querySelector<HTMLElement>(DEL);
        if (e.key === "ArrowRight" && !onDelete && del) del.focus();
        else if (e.key === "ArrowLeft" && onDelete) focusInGrid(row);
        return;
      }
      // Only from the row itself: from a delete button, Up stays in the delete column.
      if (e.key === "ArrowUp" && i === 0 && !onDelete) {
        const head = lastHead.current?.isConnected ? lastHead.current : headings()[0];
        head?.focus();
        return;
      }
      const to =
        e.key === "ArrowDown"
          ? Math.min(i + 1, rows.length - 1)
          : e.key === "ArrowUp"
            ? Math.max(i - 1, 0)
            : e.key === "Home"
              ? 0
              : rows.length - 1;
      const dest = rows[to];
      focusInGrid((onDelete && dest.querySelector<HTMLElement>(DEL)) || dest);
    };

    const onHeadKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = e.target as HTMLElement;
      if (!target.matches(SORT)) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const hs = headings();
        const n = hs.indexOf(target) + (e.key === "ArrowRight" ? 1 : -1);
        hs[n]?.focus();
        return;
      }
      // Always the first row, not the selected one: a list is entered at the top.
      if (e.key !== "ArrowDown") return;
      const first = tbody.firstElementChild as HTMLElement | null;
      if (!first) return;
      e.preventDefault();
      lastHead.current = target;
      focusInGrid(first);
    };

    tbody.addEventListener("focusout", onFocusOut);
    tbody.addEventListener("focusin", onFocusIn);
    tbody.addEventListener("keydown", onRowKey);
    headRow.addEventListener("keydown", onHeadKey);
    return () => {
      tbody.removeEventListener("focusout", onFocusOut);
      tbody.removeEventListener("focusin", onFocusIn);
      tbody.removeEventListener("keydown", onRowKey);
      headRow.removeEventListener("keydown", onHeadKey);
    };
  }, [tbodyRef, headRowRef, scrollerRef]);

  const rememberFocus = () => {
    const tbody = tbodyRef.current;
    const active = document.activeElement as HTMLElement | null;
    const row = active && tbody?.contains(active) ? active.closest("tr") : null;
    pending.current = row
      ? { index: Array.from(tbody?.children ?? []).indexOf(row), onDelete: active !== row }
      : null;
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: `rowCount` is the intended trigger — it changes when the delete commits.
  useLayoutEffect(() => {
    const target = pending.current;
    pending.current = null;
    const tbody = tbodyRef.current;
    if (!target || !tbody) return;
    const rows = Array.from(tbody.children) as HTMLElement[];
    if (rows.length === 0) {
      // The nearest thing still there, and where ArrowUp from the top row goes.
      headRowRef.current?.querySelector<HTMLElement>(SORT)?.focus({ preventScroll: true });
      return;
    }
    const back = rows[Math.min(target.index, rows.length - 1)];
    focusInGrid((target.onDelete && back.querySelector<HTMLElement>(DEL)) || back);
  }, [rowCount]);

  return { rememberFocus };
}
