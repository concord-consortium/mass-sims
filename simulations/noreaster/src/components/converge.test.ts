import { describe, expect, it } from "vitest";
import {
  convergedArrows,
  convergenceFade,
  convergenceRotation,
  convergenceTarget,
} from "./converge";

describe("convergedArrows", () => {
  it("maps the two selected pathways to their circled arrow numbers", () => {
    expect(convergedArrows("N/NW", "S/SE")).toEqual([1, 2]); // strong
    expect(convergedArrows("W", "S/SE")).toEqual([4, 2]); // moderate
    expect(convergedArrows("N/NW", "NE")).toEqual([1, 3]); // weakCoastal
  });

  it("omits an unchosen pathway", () => {
    expect(convergedArrows("N/NW", null)).toEqual([1]);
    expect(convergedArrows(null, "NE")).toEqual([3]);
    expect(convergedArrows(null, null)).toEqual([]);
  });
});

describe("convergenceTarget", () => {
  // Arrow 2 has a zero tip offset, so its target is purely the storm start-center + nudge, independent
  // of scale: storm center is (width/2 − 18, height/2 + 36), and arrow 2's nudge is (−8, +14).
  it("places the zero-tip arrow (2) at the storm center + nudge, at any size", () => {
    expect(convergenceTarget(2, { width: 1000, height: 500 })).toEqual({ x: 474, y: 300 });
    expect(convergenceTarget(2, { width: 1400, height: 700 })).toEqual({ x: 674, y: 400 });
  });

  // Tip-anchored arrows scale with the frame (tip offset × scale = height/265). Verify at two sizes so a
  // constant drift or a wrong basis is caught.
  it("tip-anchors the other arrows and scales them with the frame", () => {
    const small = { width: 1000, height: 500 }; // scale 500/265
    expect(convergenceTarget(1, small).x).toBeCloseTo(196.547, 2);
    expect(convergenceTarget(1, small).y).toBeCloseTo(-20.34, 2);
    expect(convergenceTarget(3, small).x).toBeCloseTo(497, 2);
    expect(convergenceTarget(3, small).y).toBeCloseTo(-31.528, 2);
    expect(convergenceTarget(4, small).x).toBeCloseTo(63.792, 2);
    expect(convergenceTarget(4, small).y).toBeCloseTo(226.302, 2);

    const large = { width: 1400, height: 700 }; // scale 700/265 — arrow 1 lands elsewhere
    expect(convergenceTarget(1, large).x).toBeCloseTo(279.566, 2);
    expect(convergenceTarget(1, large).y).toBeCloseTo(-38.075, 2);
  });
});

describe("convergenceRotation", () => {
  it("returns the per-arrow end rotation (0 for an unknown number)", () => {
    expect(convergenceRotation(1)).toBe(7);
    expect(convergenceRotation(2)).toBe(8);
    expect(convergenceRotation(3)).toBe(8);
    expect(convergenceRotation(4)).toBe(-6);
    expect(convergenceRotation(9)).toBe(0);
  });
});

describe("convergenceFade", () => {
  it("is full for the first half, then linear to 0", () => {
    expect(convergenceFade(0)).toBe(1);
    expect(convergenceFade(0.5)).toBe(1);
    expect(convergenceFade(0.75)).toBeCloseTo(0.5, 5);
    expect(convergenceFade(1)).toBe(0);
  });
});
