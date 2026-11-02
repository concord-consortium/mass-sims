import { type RefObject, useEffect } from "react";

/**
 * Opens and closes a dialog that is a child of the frame's `main`. On mount it makes everything
 * else in the frame inert (the other children of `main`, and every child of the frame but `main`:
 * the title bar and an open About panel), then focuses `initialFocus`. On unmount it removes
 * `inert`, then focuses the element `opener` selects in the frame.
 *
 * Both happen in one effect because the order matters: `focus()` on an element inside an inert
 * subtree does nothing, and the opener is inside what was inert. The live region is outside the
 * frame, so it is never made inert and announcements are still heard.
 */
export function useDialogLifecycle(
  rootRef: RefObject<HTMLElement | null>,
  { initialFocus, opener }: { initialFocus: RefObject<HTMLElement | null>; opener: string },
) {
  useEffect(() => {
    const root = rootRef.current;
    const main = root?.parentElement;
    const frame = main?.parentElement;
    // Anywhere but directly in `main`, the wrong elements would go inert, so do nothing instead.
    if (!root || main?.tagName !== "MAIN" || !frame) return;
    // Skips anything already inert, so closing does not un-inert what something else made inert.
    const behind = [...main.children, ...frame.children].filter(
      (el) => el !== root && el !== main && !el.hasAttribute("inert"),
    );
    for (const el of behind) el.setAttribute("inert", "");
    initialFocus.current?.focus({ preventScroll: true });
    return () => {
      for (const el of behind) el.removeAttribute("inert");
      frame.querySelector<HTMLElement>(opener)?.focus({ preventScroll: true });
    };
  }, [rootRef, initialFocus, opener]);
}
