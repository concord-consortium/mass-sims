import { describe, expect, it } from "vitest";
import { TIMELINE_SEGMENTS, TIMELINE_STOPS } from "./timeline";
import { DESIGN_SPAN, layoutTimeline, MIN_SPAN, nearestValueIndexByPx } from "./timeline-layout";

// Synthetic label widths: year line, then event lines. The end marker has only its year.
const LINES: number[][] = [
  [60, 80, 96],
  [60, 92, 100],
  [56, 50, 56],
  [50, 56, 58],
  [36, 50, 52],
  [28, 60, 62],
  [28],
];
const HALF_FIRST = 96 / 2;
const HALF_LAST = 28 / 2;

const layoutAtSpan = (span: number) =>
  layoutTimeline({
    rowWidth: span + HALF_FIRST + HALF_LAST,
    stopLineWidths: LINES,
    stops: TIMELINE_STOPS,
    segments: TIMELINE_SEGMENTS,
  });

describe("layoutTimeline", () => {
  it("insets the rail by half the end stops' widths", () => {
    const layout = layoutAtSpan(DESIGN_SPAN);
    expect(layout.inset).toBe(HALF_FIRST);
    expect(layout.span).toBeCloseTo(DESIGN_SPAN);
  });

  it("uses the 24px icon slot when it is wider than every label line", () => {
    const layout = layoutTimeline({
      rowWidth: 800,
      stopLineWidths: [[10], ...LINES.slice(1, -1), [12]],
      stops: TIMELINE_STOPS,
      segments: TIMELINE_SEGMENTS,
    });
    expect(layout.inset).toBe(12);
    expect(layout.span).toBe(800 - 24);
  });

  it("puts every dot at its design fraction at the design span", () => {
    const layout = layoutAtSpan(DESIGN_SPAN);
    TIMELINE_STOPS.forEach((stop, i) => {
      expect(layout.dotPx[i]).toBeCloseTo(stop.at * DESIGN_SPAN + HALF_FIRST);
    });
  });

  it("keeps the last two gaps at their design size at the min span", () => {
    const layout = layoutAtSpan(MIN_SPAN);
    const n = TIMELINE_STOPS.length;
    const designGap = (i: number) =>
      (TIMELINE_STOPS[i].at - TIMELINE_STOPS[i - 1].at) * DESIGN_SPAN;
    expect(layout.dotPx[n - 1] - layout.dotPx[n - 2]).toBeCloseTo(designGap(n - 1));
    expect(layout.dotPx[n - 2] - layout.dotPx[n - 3]).toBeCloseTo(designGap(n - 2));
  });

  it("lands the last dot on the right edge at any span", () => {
    for (const span of [MIN_SPAN - 40, MIN_SPAN, 600, 700, DESIGN_SPAN, DESIGN_SPAN + 40]) {
      const layout = layoutAtSpan(span);
      expect(layout.dotPx.at(-1)).toBeCloseTo(layout.inset + span);
      expect(layout.dotPx[0]).toBeCloseTo(layout.inset);
    }
  });

  it("gives the four free gaps equal spacing between labels at the min span", () => {
    const layout = layoutAtSpan(MIN_SPAN);
    // The space left between two neighbors' labels, on the line where they come closest.
    const spacing = (i: number) => {
      const a = LINES[i - 1];
      const b = LINES[i];
      let widest = 0;
      for (let r = 0; r < Math.min(a.length, b.length); r++) {
        widest = Math.max(widest, (a[r] + b[r]) / 2);
      }
      return layout.dotPx[i] - layout.dotPx[i - 1] - widest;
    };
    const free = [1, 2, 3, 4].map(spacing);
    for (const s of free) expect(s).toBeCloseTo(free[0]);
    expect(free[0]).toBeGreaterThan(0);
  });

  it("keeps the dots in order at any span", () => {
    for (const span of [MIN_SPAN - 40, MIN_SPAN, 600, 700, DESIGN_SPAN, DESIGN_SPAN + 40]) {
      const { dotPx } = layoutAtSpan(span);
      for (let i = 1; i < dotPx.length; i++) expect(dotPx[i]).toBeGreaterThan(dotPx[i - 1]);
    }
  });

  it("splits the rail at the 0 dot", () => {
    const layout = layoutAtSpan(650);
    const zero = TIMELINE_STOPS.findIndex((s) => s.years === 0);
    expect(layout.railSplit).toBe(layout.dotPx[zero]);
  });

  it("places each value between its two dots", () => {
    const layout = layoutAtSpan(650);
    TIMELINE_SEGMENTS.forEach((sg, i) => {
      const a = layout.dotPx[sg.hi];
      const b = layout.dotPx[sg.hi + 1];
      expect(layout.valuePx[i]).toBeCloseTo(a + sg.t * (b - a));
    });
  });
});

describe("nearestValueIndexByPx", () => {
  const valuePx = [10, 30, 50, 90];

  it("picks the nearest value", () => {
    expect(nearestValueIndexByPx(valuePx, 0)).toBe(0);
    expect(nearestValueIndexByPx(valuePx, 33)).toBe(1);
    expect(nearestValueIndexByPx(valuePx, 75)).toBe(3);
    expect(nearestValueIndexByPx(valuePx, 500)).toBe(3);
  });

  it("resolves a tie to the lower index", () => {
    expect(nearestValueIndexByPx(valuePx, 20)).toBe(0);
    expect(nearestValueIndexByPx(valuePx, 70)).toBe(2);
  });
});
