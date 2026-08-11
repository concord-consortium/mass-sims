import { type RefObject, useLayoutEffect } from "react";
import type { Outcome } from "../model/weather";

/**
 * Show the Data panel's condensable attribute labels (Precipitation Type/Amount) in short form on any row
 * where the full label would push the value onto a second line. It's measured per row because whether the
 * full label fits depends on the value (and so on the outcome). Re-measures on resize and on outcome
 * change; `useLayoutEffect` settles it before paint. The `ResizeObserver` is guarded because jsdom has
 * none (tests render the full labels).
 *
 * Operates on the Data-panel row markup: reads `.wo-row` / `.wo-value` / `.wo-label-short` and toggles
 * `.wo-row--condensed`, which the SCSS keys the label swap off of.
 */
export function useCondensedLabels(
  panelRef: RefObject<HTMLElement | null>,
  outcome: Outcome | null,
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `outcome` is a deliberate re-measure trigger — the effect reads the DOM, whose value text changes with the outcome.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const measure = () => {
      for (const row of panel.querySelectorAll<HTMLElement>(".wo-row")) {
        const value = row.querySelector<HTMLElement>(".wo-value");
        if (!value || !row.querySelector(".wo-label-short")) continue; // condensable rows only
        row.classList.remove("wo-row--condensed"); // measure with the full label shown
        const lineHeight = Number.parseFloat(getComputedStyle(value).lineHeight) || 24;
        if (value.offsetHeight > lineHeight * 1.5) {
          row.classList.add("wo-row--condensed"); // the full label wrapped the value → use the short form
        }
      }
    };
    measure();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(panel);
    return () => observer?.disconnect();
  }, [panelRef, outcome]);
}
