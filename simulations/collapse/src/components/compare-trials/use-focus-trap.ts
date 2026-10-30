import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([tabindex="-1"]), [tabindex="0"]';

/**
 * Keeps Tab and Shift+Tab inside `rootRef`: from the last focusable element Tab wraps to the first,
 * and from the first Shift+Tab wraps to the last. Needed even with the rest of the frame inert,
 * because when the sim is embedded the page around the frame is not.
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
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
