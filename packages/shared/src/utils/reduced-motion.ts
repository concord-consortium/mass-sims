/**
 * True when the user has requested reduced motion. Guarded so it also works where `matchMedia`
 * is absent (jsdom/SSR), where it defaults to false (motion allowed).
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Scroll `el` just into view within its nearest scrollable ancestor — smoothly, unless the user
 * prefers reduced motion (then instant). `block: "nearest"` leaves an already-visible element put.
 * `scrollIntoView` is optional-chained so it's a no-op where the API is absent (jsdom/SSR).
 */
export function smoothScrollIntoView(el: Element): void {
  el.scrollIntoView?.({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
}
