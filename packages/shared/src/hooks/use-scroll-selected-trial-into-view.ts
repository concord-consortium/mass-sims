import { type RefObject, useEffect, useRef } from "react";
import { smoothScrollIntoView } from "../utils/reduced-motion";

/**
 * Trials-panel helper shared across sims. Returns a ref to attach to the trials-list container;
 * whenever `selectedLetter` changes, the currently-selected card (`.trial-card-wrapper.selected`,
 * rendered by the shared TrialCard) is scrolled just into view via `smoothScrollIntoView`.
 * The card's `scroll-margin` (set on `.trial-card-wrapper`) keeps it clear of the floating section title.
 */
export function useScrollSelectedTrialIntoView<T extends HTMLElement = HTMLDivElement>(
  selectedLetter: string,
): RefObject<T | null> {
  const ref = useRef<T>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref isn't a reactive dep; selectedLetter is the intended trigger — the effect reads whichever card is currently `.selected` whenever selection changes.
  useEffect(() => {
    const selected = ref.current?.querySelector<HTMLElement>(".trial-card-wrapper.selected");
    if (selected) smoothScrollIntoView(selected);
  }, [selectedLetter]);
  return ref;
}
