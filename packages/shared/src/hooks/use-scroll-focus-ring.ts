import { type RefObject, useCallback, useEffect, useState } from "react";

/**
 * Makes a scrollable region keyboard-operable. A region that overflows is given `tabindex="0"`
 * so keyboard-only users can focus it and scroll with the arrow keys; a region that fits loses
 * the attribute so it isn't a dead tab stop. Re-evaluates whenever the element resizes
 * (ResizeObserver) or its content changes (MutationObserver). Pair with the shared
 * `.scroll-region` + sibling `.scroll-focus-ring` styles, which draw the inset focus ring only
 * on `:focus-visible`.
 *
 * Returns a **callback ref** (not a RefObject): the tracked element is held in state, so the
 * effect re-runs when a conditionally-rendered scroller (e.g. the About modal body) mounts or
 * unmounts. Pass an existing `RefObject` (e.g. a scroller referenced elsewhere for its
 * scrollTop) to share one element — the callback writes through to `externalRef.current`.
 */
export function useScrollFocusRing<T extends HTMLElement = HTMLDivElement>(
  externalRef?: RefObject<T | null>,
): (node: T | null) => void {
  const [element, setElement] = useState<T | null>(null);

  const setRef = useCallback(
    (node: T | null) => {
      setElement(node);
      if (externalRef) externalRef.current = node;
    },
    [externalRef],
  );

  useEffect(() => {
    if (!element) return;
    const el = element;

    const update = () => {
      if (el.scrollHeight > el.clientHeight) el.setAttribute("tabindex", "0");
      else el.removeAttribute("tabindex");
    };
    update();

    // Size changes (layout/resize) and content changes can both flip whether the region overflows,
    // so watch for both. The MutationObserver covers content growth that ResizeObserver misses
    // (scrollHeight grows without the element's own box changing): nodes added/removed (childList)
    // AND in-place text edits (characterData — e.g. a live counter React updates without replacing
    // the text node). Guarded for jsdom/SSR where the constructors may be absent.
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resize?.observe(el);
    const mutation = typeof MutationObserver !== "undefined" ? new MutationObserver(update) : null;
    mutation?.observe(el, { childList: true, characterData: true, subtree: true });

    return () => {
      resize?.disconnect();
      mutation?.disconnect();
    };
  }, [element]);

  return setRef;
}
