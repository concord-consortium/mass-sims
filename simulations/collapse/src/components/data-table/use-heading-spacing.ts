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

// The hover band has a 2px white edge on each side, so a 6px gap that can be seen needs 8px of band.
const HEAD_EDGE = 2;
/** The smallest space inside a band on each side of its label and icon. */
export const HEAD_MIN_BAND_PADDING = 6 + HEAD_EDGE;
/**
 * The smallest space kept between two headings' ink (label and icon). Twice
 * `HEAD_MIN_BAND_PADDING`, so the smallest bands of two neighbors just meet.
 */
export const HEAD_GAP = 2 * HEAD_MIN_BAND_PADDING;

export interface SpacingOptions {
  /** The smallest space kept between two headings' ink. */
  gap?: number;
  /** The smallest space inside a band on each side of its ink. */
  minBandPadding?: number;
  /**
   * A right edge no band or ink may pass. A heading that would is moved left, and the overlap is
   * pushed on to its left neighbors. The left edge has no limit.
   */
  rightBound?: number;
}

/**
 * Spacing for the three sort headings, from their ink (label and icon) and their button boxes,
 * both measured unshifted and ungrown.
 *
 * At narrow widths the middle heading, "Erosion rate (mm/1,000 yr)", is wider than its column. It
 * stays centered; the outer two slide outward only as far as needed to keep `gap` from it. With a
 * `rightBound`, a heading that would pass it is moved left instead (see `SpacingOptions`). Then
 * each band grows to contain its own ink plus `minBandPadding` on each side, and may spread to its
 * column edges. Where two bands would overlap, they meet at one boundary in the space between their
 * smallest extents, so pointing at a label always hits that label's button. At a wide layout
 * everything is 0.
 */
export function spaceHeadings(
  inks: readonly Span[],
  boxes: readonly Span[],
  { gap = HEAD_GAP, minBandPadding = HEAD_MIN_BAND_PADDING, rightBound }: SpacingOptions = {},
): HeadingSpacing[] {
  const shift = [0, 0, 0];
  const roomL = inks[1].l - gap - inks[0].r;
  if (roomL < 0) shift[0] = roomL;
  const roomR = inks[2].l - (inks[1].r + gap);
  if (roomR < 0) shift[2] = -roomR;

  if (rightBound !== undefined) {
    const over = inks[2].r + shift[2] + minBandPadding - rightBound;
    if (over > 0) shift[2] -= over;
    for (let i = 1; i >= 0; i--) {
      const crowd = inks[i].r + shift[i] + gap - (inks[i + 1].l + shift[i + 1]);
      if (crowd > 0) shift[i] -= crowd;
    }
  }

  const ink = inks.map((s, i) => ({ l: s.l + shift[i], r: s.r + shift[i] }));
  const minBandL = ink.map((s) => s.l - minBandPadding);
  const minBandR = ink.map((s) => s.r + minBandPadding);
  const L = boxes.map((b, i) => Math.min(b.l, minBandL[i]));
  const R = boxes.map((b, i) => Math.max(b.r, minBandR[i]));
  if (rightBound !== undefined) R[2] = Math.min(R[2], rightBound);

  for (let i = 0; i < 2; i++) {
    if (R[i] > L[i + 1]) {
      const lo = minBandR[i];
      const hi = minBandL[i + 1];
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

/** A heading's label and icon: the button's children. */
function inkOf(button: HTMLElement): Span {
  const rects = Array.from(button.children, (child) => child.getBoundingClientRect());
  return { l: Math.min(...rects.map((r) => r.left)), r: Math.max(...rects.map((r) => r.right)) };
}

/**
 * Applies `spaceHeadings` to the three sort buttons in the header row, writing the CSS variables
 * the table's stylesheet reads. Re-runs when the header row resizes and once the webfonts load,
 * because both change the headings' widths. `clampRight` keeps every band and ink inside the
 * row's right edge.
 */
export function useHeadingSpacing(
  headRowRef: RefObject<HTMLTableRowElement | null>,
  {
    gap,
    minBandPadding,
    clampRight = false,
  }: { gap?: number; minBandPadding?: number; clampRight?: boolean } = {},
) {
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
      const rightBound = clampRight ? row.getBoundingClientRect().right : undefined;
      spaceHeadings(inks, boxes, { gap, minBandPadding, rightBound }).forEach(
        ({ shift, growL, growR }, i) => {
          buttons[i].style.setProperty("--head-shift", `${shift.toFixed(2)}px`);
          buttons[i].style.setProperty("--grow-l", `${growL.toFixed(2)}px`);
          buttons[i].style.setProperty("--grow-r", `${growR.toFixed(2)}px`);
        },
      );
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
  }, [headRowRef, gap, minBandPadding, clampRight]);
}
