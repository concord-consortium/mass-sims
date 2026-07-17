import { type RefObject, useLayoutEffect } from "react";

/**
 * Continuous responsive scaling for the Simulation panel's controls.
 *
 * A `ResizeObserver` measures the panel width and writes interpolated sizes (gap, paddings, caret,
 * icon sizes) as CSS custom properties on the panel root; the SCSS only *applies* them (its `var()`
 * fallbacks are the widest/Lato values — a sensible baseline if the JS never runs). The first
 * `apply()` runs in a `useLayoutEffect`, before the browser paints, so on the client the interpolated
 * sizes (not the fallbacks) are already in place at first paint. Because the grid's dropdown columns
 * are already flexible (`minmax`), their widths scale on their own; this smooths everything else so
 * the layout no longer jumps at a breakpoint.
 *
 * Two things can't be interpolated and stay discrete: the control font swaps to Roboto Condensed
 * (`data-nor-condensed`) and the "Temperature" header shortens to "Temp" (`data-nor-temp-short`),
 * each toggled once — at the panel width where Lato / the full word stops fitting.
 */

// Panel-width interpolation range: t = 0 at (or below) MIN, t = 1 at (or above) MAX.
const PW_MIN = 376; // narrowest target panel (AP 2-column)
const PW_MAX = 520; // widest panel at which the full Lato layout fits comfortably

// Panel widths at which the discrete swaps flip (measured — see the hook's docstring).
const CONDENSE_BELOW = 452; // Lato controls stop fitting → Roboto Condensed
const TEMP_SHORT_BELOW = 430; // condensed "Temperature" stops fitting its column → "Temp"

/** One interpolated custom property: `[cssVar, valueAtT0, valueAtT1]`, emitted as `<n>px`. */
const PROPS: readonly [string, number, number][] = [
  // Air-mass grid
  ["--nor-col-gap", 6, 10],
  ["--nor-am-gap", 4, 8],
  ["--nor-am-icon", 22, 24],
  ["--nor-caret", 18, 24],
  ["--nor-trigger-pad-x", 4, 10],
  // Control bar
  ["--nor-cb-gap", 6, 10],
  ["--nor-cb-icon", 22, 24],
  ["--nor-cb-btn-pad-l", 6, 8],
  ["--nor-cb-btn-pad-r", 8, 12],
  ["--nor-cb-btn-gap", 2, 4],
  ["--nor-toggle-pad-x", 6, 10],
  ["--nor-toggle-gap", 4, 6],
];

function apply(panel: HTMLElement) {
  const pw = panel.clientWidth;
  if (pw <= 0) return; // no layout yet (e.g. jsdom) — leave the SCSS Lato fallbacks in place
  const t = Math.max(0, Math.min(1, (pw - PW_MIN) / (PW_MAX - PW_MIN)));
  for (const [name, a, b] of PROPS) {
    panel.style.setProperty(name, `${Math.round((a + (b - a) * t) * 100) / 100}px`);
  }
  panel.toggleAttribute("data-nor-condensed", pw < CONDENSE_BELOW);
  panel.toggleAttribute("data-nor-temp-short", pw < TEMP_SHORT_BELOW);
}

/** Observe the panel and keep its scaling custom properties / condensed flags in sync with width. */
export function useNorScaling(panelRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    apply(panel);

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => apply(panel)) : null;
    observer?.observe(panel);

    return () => observer?.disconnect();
  }, [panelRef]);
}
