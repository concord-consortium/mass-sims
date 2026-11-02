import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([tabindex="-1"]), [tabindex="0"]';

function isAfter(node: Node, reference: Node) {
  return (reference.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Keeps Tab and Shift+Tab inside `rootRef`: from the last focusable element, or anything after it,
 * Tab wraps to the first, and from the first, or anything before it, Shift+Tab wraps to the last.
 * From the root itself, Tab goes to the first and Shift+Tab to the last. Needed even with the rest
 * of the frame inert, because when the sim is embedded the page around the frame is not.
 */
export function useFocusTrap(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Only elements that are showing: one with no layout boxes cannot take focus.
      const focusables = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active) return;
      // An element past the last one is focused with the arrow keys (a row with tabindex="-1"), and
      // the root takes focus on a click on its text. From either, the browser's next stop could be
      // outside, so they wrap too.
      if (!e.shiftKey && (active === last || active === root || isAfter(active, last))) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === root || isAfter(first, active))) {
        e.preventDefault();
        last.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
