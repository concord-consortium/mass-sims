import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([tabindex="-1"]), [tabindex="0"]';

function isAfter(node: Node, reference: Node) {
  return (reference.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/**
 * Keeps Tab and Shift+Tab inside the frame around `rootRef` (the parent of its `main`) by wrapping
 * at the ends. Only the parts that are not inert count: the dialog, the About button, and an open
 * About panel. Needed even with the rest of the frame inert, because when the sim is embedded the
 * page around the frame is not. Outside a `main`, it traps inside `rootRef`.
 */
export function useFocusTrap(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const main = root.parentElement;
    const scope = main?.tagName === "MAIN" && main.parentElement ? main.parentElement : root;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Only elements that are showing: one with no layout boxes cannot take focus.
      const focusables = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.getClientRects().length > 0 && !el.closest("[inert]"),
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!active) return;
      // An element past the last one is focused with the arrow keys (a row with tabindex="-1"), and
      // the scope takes focus on a click on its text. From either, the browser's next stop could be
      // outside, so they wrap too.
      if (!e.shiftKey && (active === last || active === scope || isAfter(active, last))) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === scope || isAfter(first, active))) {
        e.preventDefault();
        last.focus();
      }
    };
    scope.addEventListener("keydown", onKeyDown);
    return () => scope.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
