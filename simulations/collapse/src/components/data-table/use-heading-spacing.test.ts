import { describe, expect, it } from "vitest";
import {
  HEAD_AIR,
  HEAD_HUG,
  type HeadingSpacing,
  type Span,
  spaceHeadings,
} from "./use-heading-spacing";

/** Three equal columns of `width`, each with ink of the given width centered in it. */
function layout(width: number, inkWidths: [number, number, number]) {
  const boxes: Span[] = [0, 1, 2].map((i) => ({ l: i * width, r: (i + 1) * width }));
  const inks: Span[] = boxes.map((b, i) => {
    const c = (b.l + b.r) / 2;
    return { l: c - inkWidths[i] / 2, r: c + inkWidths[i] / 2 };
  });
  return { boxes, inks };
}

/** How far the ink actually moves: the shift plus the re-centering that the grows cause. */
const moved = (h: HeadingSpacing) => h.shift + (h.growR - h.growL) / 2;
const band = (b: Span, h: HeadingSpacing): Span => ({ l: b.l - h.growL, r: b.r + h.growR });

describe("spaceHeadings", () => {
  it("leaves a wide layout alone", () => {
    const { boxes, inks } = layout(150, [90, 112, 80]);
    for (const h of spaceHeadings(inks, boxes)) {
      expect(h.shift).toBeCloseTo(0, 10);
      expect(h.growL).toBeCloseTo(0, 10);
      expect(h.growR).toBeCloseTo(0, 10);
    }
  });

  it("holds the middle heading still and moves the outer two out by exactly the overlap", () => {
    // 90px columns: the middle ink is 79..191 and the outer inks end at 85 and start at 185.
    const { boxes, inks } = layout(90, [80, 112, 80]);
    const [left, mid, right] = spaceHeadings(inks, boxes);
    const overlapL = inks[0].r - (inks[1].l - HEAD_AIR);
    const overlapR = inks[1].r + HEAD_AIR - inks[2].l;
    expect(overlapL).toBeGreaterThan(0);
    expect(moved(left)).toBeCloseTo(-overlapL, 10);
    expect(moved(mid)).toBeCloseTo(0, 10);
    expect(moved(right)).toBeCloseTo(overlapR, 10);
  });

  it("does not move an outer heading that already has the air", () => {
    // The left ink is narrow enough to keep HEAD_AIR; the right one is not.
    const { boxes, inks } = layout(100, [40, 112, 90]);
    const [left, , right] = spaceHeadings(inks, boxes);
    expect(moved(left)).toBeCloseTo(0, 10);
    expect(moved(right)).toBeGreaterThan(0);
  });

  it("at every width, gives each heading its own band around its ink, with no gaps or overlaps", () => {
    for (let width = 70; width <= 160; width += 2.5) {
      const { boxes, inks } = layout(width, [86, 112, 72]);
      const result = spaceHeadings(inks, boxes);
      const bands = result.map((h, i) => band(boxes[i], h));
      result.forEach((h, i) => {
        // A band never shrinks inside its own ink plus HEAD_HUG.
        const ink = { l: inks[i].l + moved(h), r: inks[i].r + moved(h) };
        expect(bands[i].l).toBeLessThanOrEqual(ink.l - HEAD_HUG + 1e-9);
        expect(bands[i].r).toBeGreaterThanOrEqual(ink.r + HEAD_HUG - 1e-9);
        // The outermost bands never pull in from the table's edges.
        if (i === 0) expect(bands[0].l).toBeLessThanOrEqual(boxes[0].l + 1e-9);
        if (i === 2) expect(bands[2].r).toBeGreaterThanOrEqual(boxes[2].r - 1e-9);
      });
      // Neighbors meet at one shared boundary.
      expect(bands[0].r).toBeCloseTo(bands[1].l, 9);
      expect(bands[1].r).toBeCloseTo(bands[2].l, 9);
    }
  });
});
