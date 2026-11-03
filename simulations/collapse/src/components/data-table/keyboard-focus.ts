import { type RefObject, useEffect, useRef } from "react";

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta"]);

/** Removes the keyboard ring (`.kb-focus`) from every row in `root` but `except`. */
export function clearRing(root: Element | null, except?: Element) {
  for (const r of root?.querySelectorAll("tr.kb-focus") ?? []) {
    if (r !== except) r.classList.remove("kb-focus");
  }
}

/**
 * Focuses `el` without the browser's own scroll, then scrolls its row the minimum into view, so
 * arrowing down a long table moves one row at a time. A row gets the ring when `kbNav` is set.
 */
export function focusInGrid(el: HTMLElement, kbNav: boolean, root: Element | null) {
  clearRing(root);
  if (kbNav && el.tagName === "TR") el.classList.add("kb-focus");
  el.focus({ preventScroll: true });
  el.closest("tr")?.scrollIntoView?.({ block: "nearest" });
}

/**
 * Tracks whether focus is moving by keyboard, and keeps the keyboard ring on the focused row in
 * `rootRef`. Returns the flag, for `focusInGrid`.
 *
 * The ring is the `.kb-focus` class, set only when focus came from the keyboard. `:focus-visible`
 * is not enough: it does not match the programmatic focus the arrow keys use, and `:focus` also
 * matches a click on a row.
 */
export function useKeyboardModality(rootRef: RefObject<HTMLElement | null>) {
  const kbNav = useRef(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    // Capture phase on the document, so the flag is set before any other handler runs, including
    // for a Tab that arrives from outside the rows.
    // A change of input without a change of focus updates the focused row's ring too, as the
    // browser's own `:focus-visible` does: a press on the row hides it, and a key brings it back.
    // A press outside the rows (the scrollbar) and a modifier key alone leave it as it is.
    const onPointerDown = (e: PointerEvent) => {
      kbNav.current = false;
      if (root.contains(e.target as Node)) clearRing(root);
    };
    const onAnyKey = (e: KeyboardEvent) => {
      kbNav.current = true;
      if (MODIFIERS.has(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      const active = document.activeElement;
      if (active?.tagName === "TR" && root.contains(active)) {
        clearRing(root, active);
        active.classList.add("kb-focus");
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      if (!root.contains(e.relatedTarget as Node | null)) clearRing(root);
    };
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      clearRing(root, target);
      if (kbNav.current && target.tagName === "TR") target.classList.add("kb-focus");
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onAnyKey, true);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onAnyKey, true);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("focusin", onFocusIn);
    };
  }, [rootRef]);

  return kbNav;
}
