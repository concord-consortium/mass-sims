import { type RefObject, useLayoutEffect } from "react";

/** A horizontal extent, in px. */
export interface Span {
  l: number;
  r: number;
}

export interface HeadingSpacing {
  /** How far to move the heading's contents (`--head-shift`). */
  shift: number;
  /** How far the heading's band reaches past its column on each side (`--grow-l`, `--grow-r`). */
  growL: number;
  growR: number;
}

// The lit band has a 2px white edge on each side, so a 6px gap that can be seen needs 8px of band.
const HEAD_EDGE = 2;
/** How far a band reaches past its own label and icon, at least. */
export const HEAD_HUG = 6 + HEAD_EDGE;
/** How far apart the headings' ink is held. Twice `HEAD_HUG`, so two bands' floors just meet. */
export const HEAD_AIR = 2 * HEAD_HUG;

/**
 * Spacing for the three sort headings, from their ink (label and icon) and their button boxes,
 * both measured unshifted and ungrown.
 *
 * At narrow widths the middle heading, "Erosion rate (mm/1,000 yr)", is wider than its column. It
 * stays centered; the outer two slide outward only as far as needed to keep `HEAD_AIR` from it.
 * Then each band grows to contain its own ink plus `HEAD_HUG`, and may spread to its column edges.
 * Where two bands would overlap, they meet at one boundary in the slack between their floors, so
 * pointing at a label always hits that label's button. At a wide layout everything is 0.
 */
export function spaceHeadings(inks: readonly Span[], boxes: readonly Span[]): HeadingSpacing[] {
  const shift = [0, 0, 0];
  const gapL = inks[1].l - HEAD_AIR - inks[0].r;
  if (gapL < 0) shift[0] = gapL;
  const gapR = inks[2].l - (inks[1].r + HEAD_AIR);
  if (gapR < 0) shift[2] = -gapR;

  const ink = inks.map((s, i) => ({ l: s.l + shift[i], r: s.r + shift[i] }));
  const floorL = ink.map((s) => s.l - HEAD_HUG);
  const floorR = ink.map((s) => s.r + HEAD_HUG);
  const L = boxes.map((b, i) => Math.min(b.l, floorL[i]));
  const R = boxes.map((b, i) => Math.max(b.r, floorR[i]));

  for (let i = 0; i < 2; i++) {
    if (R[i] > L[i + 1]) {
      const lo = floorR[i];
      const hi = floorL[i + 1];
      const m = lo <= hi ? Math.min(Math.max((R[i] + L[i + 1]) / 2, lo), hi) : (lo + hi) / 2;
      R[i] = m;
      L[i + 1] = m;
    }
  }

  return boxes.map((b, i) => {
    const growL = b.l - L[i];
    const growR = R[i] - b.r;
    // A wider button re-centers its contents by (growR − growL) / 2; take that back out of the
    // shift, so the heading itself does not move.
    return { shift: shift[i] - (growR - growL) / 2, growL, growR };
  });
}

const VARS = ["--head-shift", "--grow-l", "--grow-r"] as const;

function inkOf(button: HTMLElement): Span {
  const lines = button.querySelector(".collapse-th-lines")?.getBoundingClientRect();
  const icon = button.querySelector(".collapse-sort-ico")?.getBoundingClientRect();
  const rects = [lines, icon].filter((r): r is DOMRect => r !== undefined);
  return { l: Math.min(...rects.map((r) => r.left)), r: Math.max(...rects.map((r) => r.right)) };
}

/**
 * Applies `spaceHeadings` to the three sort buttons in the header row, writing the CSS variables
 * the table's stylesheet reads. Re-runs when the header row resizes and once the webfonts load,
 * because both change the headings' widths.
 */
export function useHeadingSpacing(headRowRef: RefObject<HTMLTableRowElement | null>) {
  useLayoutEffect(() => {
    const row = headRowRef.current;
    if (!row) return;

    const sync = () => {
      const buttons = Array.from(row.querySelectorAll<HTMLElement>(".collapse-th-sort"));
      if (buttons.length !== 3) return;
      // Measure unshifted and ungrown, or each pass would build on the last.
      for (const b of buttons) for (const v of VARS) b.style.setProperty(v, "0px");
      const inks = buttons.map(inkOf);
      const boxes = buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { l: r.left, r: r.right };
      });
      spaceHeadings(inks, boxes).forEach(({ shift, growL, growR }, i) => {
        buttons[i].style.setProperty("--head-shift", `${shift.toFixed(2)}px`);
        buttons[i].style.setProperty("--grow-l", `${growL.toFixed(2)}px`);
        buttons[i].style.setProperty("--grow-r", `${growR.toFixed(2)}px`);
      });
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(row);
    let live = true;
    document.fonts?.ready.then(() => {
      if (live) sync();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [headRowRef]);
}
