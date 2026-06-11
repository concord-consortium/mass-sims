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

  it("clamps a non-positive bin count to 1 (no divide-by-zero / Infinity binWidth)", () => {
    // bins → max(1, n); maxValue 10 / 1 → niceStep(10) = 10 → one bin holding both values.
    expect(histogramBins([5, 10], 0)).toEqual({ counts: [2], binWidth: 10 });
    expect(histogramBins([5, 10], -7)).toEqual({ counts: [2], binWidth: 10 });
  });

  it("clamps a stray negative value into the first bin (values are expected ≥ 0)", () => {
    // target 5 → binWidth 2, 5 bins; -3 would compute a negative index, so it's clamped to bin 0.
    expect(histogramBins([-3, 0, 10], 5)).toEqual({ counts: [2, 0, 0, 0, 1], binWidth: 2 });
  });
});
