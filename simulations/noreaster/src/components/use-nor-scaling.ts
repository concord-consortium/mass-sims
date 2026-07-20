import { type RefObject, useLayoutEffect } from "react";

/**
 * Continuous responsive scaling for the Simulation panel's controls.
 *
 * A `ResizeObserver` writes interpolated sizes (column widths, gaps, paddings, caret, icons) as CSS
 * custom properties on the panel; the SCSS only applies them (its `var()` fallbacks are the Lato
 * values). The first `apply()` runs in a `useLayoutEffect`, so the interpolated sizes are in place at
 * first paint. Interpolating everything in lock-step, rather than snapping at a breakpoint, is what
 * keeps a chosen value fitting its trigger at every width.
 *
 * Two things stay discrete: the font swaps to Roboto Condensed (`data-nor-condensed`) and
 * "Temperature" shortens to "Temp" (`data-nor-temp-short`), each toggled once where Lato / the full
 * word stops fitting.
 */

// Panel-width interpolation range: t = 0 at (or below) MIN, t = 1 at (or above) MAX.
const PW_MIN = 376; // narrowest target panel (AP 2-column)
const PW_MAX = 520; // widest panel at which the full Lato layout fits comfortably

// Panel widths at which the discrete swaps flip (measured — see the hook's docstring).
const CONDENSE_BELOW = 452; // Lato controls stop fitting → Roboto Condensed
const TEMP_SHORT_BELOW = 430; // condensed "Temperature" stops fitting its column → "Temp"

/** One interpolated custom property: `[cssVar, valueAtT0, valueAtT1]`, emitted as `<n>px`. */
// Values interpolate condensed → Lato. Some are per-column (pathway=0, humidity=1, temperature=2):
// the icon↔value gap and left padding tighten per column, so each cell aliases its column's value onto
// `--nor-gap` / `--nor-padl` (see air-mass-selectors.tsx).
const PROPS: readonly [string, number, number][] = [
  // Label column floor. Its content ("…Air Mass") is ~86px, so it must not drop below 86 or the label
  // overlaps the Pathway dropdown (the condensed grid uses it as a `minmax(…, max-content)` floor).
  ["--nor-am-col", 86, 95],
  ["--nor-dd-col-1", 93, 126],
  ["--nor-dd-col-2", 93, 127],
  ["--nor-dd-col-3", 84, 123],
  // col-gap and panel padding share one pair, so the inter-column gap equals the last-column-to-edge
  // gap. Trimmed to 4 (demo is 6): our narrowest panel is ~9px tighter, and this reclaims the room the
  // dropdown columns need to reach their caps so a long value ("Humid") doesn't clip.
  ["--nor-col-gap", 4, 10],
  ["--nor-top-pad", 4, 10],
  ["--nor-dd-icon", 22, 24],
  ["--nor-caret", 18, 24],
  ["--nor-pad-r", 2, 10], // trigger padding-right (text sits flush to the caret)
  ["--nor-ph-padl", 7, 10], // placeholder padding-left (no icon, so padded in more than a value)
  // Per-column icon↔value gap, then trigger padding-left.
  ["--nor-gap-0", 4, 6],
  ["--nor-gap-1", 2, 6],
  ["--nor-gap-2", 0, 6],
  ["--nor-padl-0", 5, 10],
  ["--nor-padl-1", 3, 10],
  ["--nor-padl-2", 1, 10],
  ["--nor-am-gap", 5, 8],
  ["--nor-am-icon", 22, 24],
  // Control bar
  ["--nor-cb-gap", 6, 10],
  ["--nor-cb-icon", 22, 24],
  ["--nor-cb-btn-pad-l", 6, 8],
  ["--nor-cb-btn-pad-r", 8, 12],
  ["--nor-cb-btn-gap", 2, 4],
  ["--nor-toggle-pad-x", 6, 10],
  ["--nor-toggle-gap", 4, 6],
];

// Props also mirrored onto the document root for the portaled popover (see apply). Kept as one list so
// apply() and the effect cleanup that clears them can't drift.
const ROOT_PROPS: readonly [string, number, number][] = [
  ["--nor-dd-icon", 22, 24], // option icon (same as the trigger's)
  ["--nor-opt-padl", 7, 10], // option left padding
  ["--nor-opt-gap", 4, 8], // option icon↔text gap
];

function apply(panel: HTMLElement) {
  const pw = panel.clientWidth;
  if (pw <= 0) return; // no layout yet (e.g. jsdom) — leave the SCSS Lato fallbacks in place
  const t = Math.max(0, Math.min(1, (pw - PW_MIN) / (PW_MAX - PW_MIN)));
  const px = (a: number, b: number) => `${Math.round((a + (b - a) * t) * 100) / 100}px`;
  for (const [name, a, b] of PROPS) {
    panel.style.setProperty(name, px(a, b));
  }
  const condensed = pw < CONDENSE_BELOW;
  panel.toggleAttribute("data-nor-condensed", condensed);
  panel.toggleAttribute("data-nor-temp-short", pw < TEMP_SHORT_BELOW);
  // The popover is portaled to <body>, so mirror onto the document root what its options need: the
  // condensed flag (font) and the sizes that track the triggers (icon, left padding, icon↔text gap).
  // Single values, not per-column — only one popover is open at a time.
  const root = document.documentElement;
  root.toggleAttribute("data-nor-condensed", condensed);
  for (const [name, a, b] of ROOT_PROPS) {
    root.style.setProperty(name, px(a, b));
  }
}

/** Remove everything apply() writes onto the document root — the panel's own props unmount with it. */
function clearRoot() {
  const root = document.documentElement;
  root.removeAttribute("data-nor-condensed");
  for (const [name] of ROOT_PROPS) {
    root.style.removeProperty(name);
  }
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

    return () => {
      observer?.disconnect();
      clearRoot();
    };
  }, [panelRef]);
}
