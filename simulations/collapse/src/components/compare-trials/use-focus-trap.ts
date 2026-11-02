import { type RefObject, useEffect } from "react";

const FOCUSABLE = 'button:not([tabindex="-1"]), [tabindex="0"]';

/**
 * Keeps Tab and Shift+Tab inside `rootRef`: from the last focusable element Tab wraps to the first,
 * and from the first Shift+Tab wraps to the last. From the root itself, Tab goes to the first and
 * Shift+Tab to the last. Needed even with the rest of the frame inert,
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
      // The root itself takes focus on a click on its text, and the browser's next stop from it
      // could be outside, so it wraps too.
      const active = document.activeElement;
      if (!e.shiftKey && (active === last || active === root)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        last.focus();
      }
    };
    root.addEventListener("keydown", onKeyDown);
    return () => root.removeEventListener("keydown", onKeyDown);
  }, [rootRef]);
}
