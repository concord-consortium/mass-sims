import { describe, expect, it } from "vitest";
import { histogramBins, niceStep } from "./histogram-bins";

describe("niceStep", () => {
  it("rounds a raw step up to a friendly 1/2/5 × 10ⁿ value", () => {
    expect(niceStep(0.8)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(4.4)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(44)).toBe(50);
  });

  it("returns 1 for a non-positive raw step", () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-3)).toBe(1);
  });
});

describe("histogramBins", () => {
  it("returns a single empty bin for empty input", () => {
    expect(histogramBins([], 7)).toEqual({ counts: [0], binWidth: 1 });
  });

  it("collapses to the first bin when every value is 0", () => {
    expect(histogramBins([0, 0, 0], 7)).toEqual({ counts: [3], binWidth: 1 });
  });

  it("groups values into fixed, round-width bins", () => {
    // 0, 5, 12, 30; target 7 → raw 30/7 ≈ 4.3 → width 5; 6 bins spanning 0..30.
    expect(histogramBins([0, 5, 12, 30], 7)).toEqual({ counts: [1, 1, 1, 0, 0, 1], binWidth: 5 });
  });

  it("fits the bin count to the data so the last bin holds the largest value", () => {
    // 0 and 25 → width 5, ceil(25/5)=5 bins; the upper-edge value lands in the last bin.
    expect(histogramBins([0, 25], 7)).toEqual({ counts: [1, 0, 0, 0, 1], binWidth: 5 });
  });
});
