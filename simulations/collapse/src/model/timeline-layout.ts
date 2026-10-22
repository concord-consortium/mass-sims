import type { TimelineSegment, TimelineStop } from "./timeline";

/**
 * Spacing between two labels, so neighbors read as separate rather than merely not touching.
 * 11 and not more: the 0 / year-marker pair sits close by design, and 12 starts pushing the design
 * positions at full width to make room they do not need.
 */
export const LABEL_PAD = 11;

/**
 * The rail at the design width, with the Simulation panel at its full size. The last two gaps are
 * reproduced from this at every width so they never shrink; if the panel's full width changes, this
 * has to change with it.
 */
export const DESIGN_SPAN = 759.49;

/**
 * The narrowest the rail gets. Dots reach their equal-spacing positions exactly at this span.
 * Measured as the span, not as the timeline's own width: the row is inset from it. Follows the
 * Simulation panel's width, like `DESIGN_SPAN`.
 */
export const MIN_SPAN = 503.5;

/** A stop is as wide as its widest label line, but never narrower than its 24px icon slot. */
const ICON_SLOT = 24;

export interface TimelineLayoutInput {
  rowWidth: number;
  /** Per stop, the measured width of each label line (year first, then event lines). */
  stopLineWidths: number[][];
  stops: readonly TimelineStop[];
  segments: readonly TimelineSegment[];
}

export interface TimelineLayout {
  /** Where the rail starts: half the first stop's width, so its label stays on the track. */
  inset: number;
  /** The rail's length, from the first dot to the last. */
  span: number;
  /** One x per stop. */
  dotPx: number[];
  /** One x per landable value. */
  valuePx: number[];
  /** Where the solid rail ends and the dashed tail starts: the 0 dot. */
  railSplit: number;
}

/**
 * Places every dot on a straight line between two fixed layouts, by how wide the rail is:
 *
 *   START  the design layout, at `DESIGN_SPAN`
 *   END    equal spacing between every label, at `MIN_SPAN`
 *
 * Both endpoints are fixed, so as the window narrows each dot moves one direction at one speed.
 * Each endpoint fills its own span exactly and the blend is linear in the span, so the last dot
 * always lands on the right edge. Deliberately not clamped: outside the two widths it extrapolates
 * along the same line and still fills the rail.
 *
 * In both layouts the last two gaps (20 → 0 → year marker) are their design size in pixels, so that
 * cluster slides as a rigid block and never compresses.
 */
export function layoutTimeline({
  rowWidth,
  stopLineWidths,
  stops,
  segments,
}: TimelineLayoutInput): TimelineLayout {
  const stopWidth = (lines: number[]) => Math.max(ICON_SLOT, ...lines);
  const halfFirst = stopWidth(stopLineWidths[0]) / 2;
  const halfLast = stopWidth(stopLineWidths[stopLineWidths.length - 1]) / 2;
  const inset = halfFirst;
  const span = Math.max(0, rowWidth - halfFirst - halfLast);

  // What each neighboring pair needs, compared line against line: two stops only collide on the
  // same row, so the year marker (one line) never meets "collapses" however close it sits.
  const need = stopLineWidths.map((b, i) => {
    if (!i) return 0;
    const a = stopLineWidths[i - 1];
    let most = 0;
    for (let r = 0; r < Math.min(a.length, b.length); r++) {
      most = Math.max(most, (a[r] + b[r]) / 2 + LABEL_PAD);
    }
    return most;
  });

  const nGaps = stops.length - 1;
  const designGap = stops.map((st, i) => (i ? (st.at - stops[i - 1].at) * DESIGN_SPAN : 0));
  const tailPx = designGap[nGaps] + designGap[nGaps - 1];

  // END: the head shares what is left of the narrowest rail as equal spacing.
  const ink = need.map((n, i) => (i ? n - LABEL_PAD : 0));
  let inkHead = 0;
  for (let i = 1; i <= nGaps - 2; i++) inkHead += ink[i];
  const endSpacing = (MIN_SPAN - tailPx - inkHead) / (nGaps - 2);

  const startAt = [0];
  const endAt = [0];
  for (let i = 1; i < stops.length; i++) {
    startAt[i] = startAt[i - 1] + designGap[i];
    endAt[i] = endAt[i - 1] + (i <= nGaps - 2 ? ink[i] + endSpacing : designGap[i]);
  }

  const t = (span - MIN_SPAN) / (DESIGN_SPAN - MIN_SPAN);
  const dotPx = stops.map((_, i) => inset + endAt[i] + t * (startAt[i] - endAt[i]));

  // The values follow the dots they are pinned between.
  const valuePx = segments.map((sg) => dotPx[sg.hi] + sg.t * (dotPx[sg.hi + 1] - dotPx[sg.hi]));

  return { inset, span, dotPx, valuePx, railSplit: dotPx[dotPx.length - 2] };
}

/**
 * The index of the value nearest `x`, in pixels rather than track fractions, because the values
 * move with the dots on a narrow rail. A tie goes to the lower index.
 */
export function nearestValueIndexByPx(valuePx: readonly number[], x: number): number {
  let best = 0;
  let bestD = Infinity;
  valuePx.forEach((px, i) => {
    const d = Math.abs(px - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}
