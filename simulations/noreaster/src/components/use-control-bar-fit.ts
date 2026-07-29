import { type RefObject, useLayoutEffect } from "react";

/**
 * Fit-based sizing for the bottom control bar (map-view toggle + Run/Replay + Reset Trial), separate
 * from the dropdown scaling. Controls stay full Lato while they fit; once they'd overflow they condense
 * (Roboto Condensed 500), narrow their padding, and take explicit widths that fill the bar.
 *
 * Direct DOM writes so the fit can be measured in both states. Layout effect (settles before paint);
 * no-ops in jsdom (clientWidth 0), leaving the SCSS full-Lato defaults.
 */

const CB_PAD = 10; // .control-bar horizontal padding
const CONDENSED = "'Roboto Condensed', sans-serif";

// Full (Lato) ↔ min (condensed) endpoints.
const csGap = { full: 10, min: 6 }; // .control-bar gap
const togglePad = { full: 10, min: 6 }; // .map-view-button padding-x
const toggleGap = { full: 6, min: 5 }; // .map-view-button gap
const btnPadL = { full: 8, min: 6 };
const btnPadR = { full: 12, min: 8 };
const btnGap = { full: 4, min: 3 };
const btnIcon = { full: 24, min: 22 };

type Pair = { full: number; min: number };

function setIcon(btn: HTMLElement, size: string) {
  const icon = btn.querySelector<HTMLElement>(".control-button-icon");
  if (icon) {
    icon.style.width = size;
    icon.style.height = size;
  }
}

function sizeControlBar(bar: HTMLElement) {
  if (bar.clientWidth <= 0) return; // no layout yet (jsdom)
  const toggle = bar.querySelector<HTMLElement>(".map-view-toggle");
  const toggleHit = bar.querySelector<HTMLElement>(".map-view-button");
  if (!toggle || !toggleHit) return;
  const btns = Array.from(bar.querySelectorAll<HTMLElement>(".control-button"));
  const labels = Array.from(bar.querySelectorAll<HTMLElement>(".map-view-state"));
  const kids = Array.from(bar.children) as HTMLElement[];
  const numGaps = kids.length - 1;

  // Full Lato state (clearing inline overrides falls back to the SCSS full values).
  bar.style.gap = `${csGap.full}px`;
  toggleHit.style.padding = `0 ${togglePad.full}px`;
  toggleHit.style.gap = `${toggleGap.full}px`;
  toggle.style.width = "";
  for (const label of labels) {
    label.style.fontFamily = "";
    label.style.flex = "1";
    label.style.overflow = "";
  }
  for (const btn of btns) {
    btn.style.fontFamily = "";
    btn.style.fontWeight = "";
    btn.style.width = "";
    btn.style.padding = "";
    btn.style.gap = "";
    setIcon(btn, "");
  }
  for (const kid of kids) kid.style.width = "";

  const fullW = kids.map((k) => k.getBoundingClientRect().width);
  const fullUsed = fullW.reduce((a, b) => a + b, 0) + numGaps * csGap.full;
  const avail = bar.clientWidth - 2 * CB_PAD;
  const fullLabelW = labels.map((l) => l.getBoundingClientRect().width);

  if (avail >= fullUsed) return; // fits at full Lato

  // Condensed min-padding state.
  bar.style.gap = `${csGap.min}px`;
  toggleHit.style.padding = `0 ${togglePad.min}px`;
  toggleHit.style.gap = `${toggleGap.min}px`;
  for (const label of labels) label.style.fontFamily = CONDENSED;
  for (const btn of btns) {
    btn.style.fontFamily = CONDENSED;
    btn.style.fontWeight = "500";
    btn.style.padding = `8px ${btnPadR.min}px 8px ${btnPadL.min}px`;
    btn.style.gap = `${btnGap.min}px`;
    setIcon(btn, `${btnIcon.min}px`);
  }
  const minLabelW = labels.map((l) => l.getBoundingClientRect().width);
  const minW = kids.map((k) => k.getBoundingClientRect().width);
  const minUsed = minW.reduce((a, b) => a + b, 0) + numGaps * csGap.min;

  // Interpolate by bt; the font stays condensed.
  const bt = Math.max(0, Math.min(1, (avail - minUsed) / (fullUsed - minUsed)));
  const lerp = (p: Pair) => p.min + bt * (p.full - p.min);
  bar.style.gap = `${lerp(csGap)}px`;
  toggleHit.style.padding = `0 ${lerp(togglePad)}px`;
  toggleHit.style.gap = `${lerp(toggleGap)}px`;
  for (const btn of btns) {
    btn.style.padding = `8px ${lerp(btnPadR)}px 8px ${lerp(btnPadL)}px`;
    btn.style.gap = `${lerp(btnGap)}px`;
    setIcon(btn, `${lerp(btnIcon)}px`);
  }
  // Explicit widths so the group fills `avail`.
  kids.forEach((kid, i) => {
    kid.style.width = `${minW[i] + bt * (fullW[i] - minW[i])}px`;
  });
  labels.forEach((label, i) => {
    label.style.flex = `0 0 ${minLabelW[i] + bt * (fullLabelW[i] - minLabelW[i])}px`;
    label.style.overflow = "hidden";
  });
}

/**
 * Observe the bar and re-fit on width change. `revalidateKey` re-fits on content changes that don't
 * alter the bar's width (Run↔Replay), which the ResizeObserver misses.
 */
export function useControlBarFit(barRef: RefObject<HTMLElement | null>, revalidateKey: unknown) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: `revalidateKey` deliberately re-triggers the DOM re-measure (Run↔Replay changes content width, not bar width).
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const run = () => sizeControlBar(bar);
    run();

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(run) : null;
    observer?.observe(bar);
    // re-measure once web fonts load (they change natural widths)
    document.fonts?.ready.then(run).catch(() => {});

    return () => observer?.disconnect();
  }, [barRef, revalidateKey]);
}
