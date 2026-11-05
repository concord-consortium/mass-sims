import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([tabindex="-1"]), [tabindex="0"]';

function isAfter(node: Node, reference: Node) {
  return (reference.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Keeps Tab and Shift+Tab inside the frame around `rootRef` (the parent of its `main`) by wrapping
 * at the ends. Only the parts that are not inert count: the dialog, the About button, and an open
 * About panel. Needed even with the panels inert, because when the sim is embedded the page around
 * the frame is not.
 */
export function useFocusTrap(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const main = rootRef.current?.parentElement;
    const frame = main?.parentElement;
    if (main?.tagName !== "MAIN" || !frame) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Only elements that are showing: one with no layout boxes cannot take focus.
      const focusables = [...frame.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active) return;
      // An element past the last one is focused with the arrow keys (a row with tabindex="-1"). From
      // there, the browser's next stop could be outside, so it wraps too.
      if (!e.shiftKey && (active === last || isAfter(active, last))) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      }
    };
    frame.addEventListener("keydown", onKeyDown);
    return () => frame.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
