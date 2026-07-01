import { type RefObject, useEffect, useRef } from "react";

/**
 * Trials-panel helper shared across sims. Returns a ref to attach to the trials-list container;
 * whenever `selectedLetter` changes, the currently-selected card (`.trial-card-wrapper.selected`,
 * rendered by the shared TrialCard) is smoothly scrolled fully into view. `block: "nearest"` is a
 * no-op when the card is already visible and confines scrolling to the nearest scrollable ancestor,
 * so a partially-clipped card slides just enough to show fully without jumping fully-visible cards.
 * The card's `scroll-margin` (set on `.trial-card-wrapper`) keeps it clear of the floating section title.
 */
export function useScrollSelectedTrialIntoView<T extends HTMLElement = HTMLDivElement>(
  selectedLetter: string,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref isn't a reactive dep; selectedLetter is the intended trigger — the effect reads whichever card is currently `.selected` whenever selection changes.
  useEffect(() => {
    const selected = ref.current?.querySelector<HTMLElement>(".trial-card-wrapper.selected");
    // Animate the scroll, unless the user prefers reduced motion. `matchMedia` is guarded so the
    // hook also works where it's absent (jsdom/SSR), defaulting to the animated path there.
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Guard the call: jsdom (and any environment lacking the API) doesn't implement scrollIntoView.
    selected?.scrollIntoView?.({
      block: "nearest",
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [selectedLetter]);
  return ref;
}
