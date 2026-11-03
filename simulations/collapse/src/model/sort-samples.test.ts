import { describe, expect, it } from "vitest";
import { sortedSamples } from "./sort-samples";
import type { Sample } from "./types";

// Each key and direction gives a different order, so a sort on the wrong key or in the wrong
// direction fails.
const samples: Sample[] = [
  { id: 1, years: 50000, rate: 18, roof: 5800 },
  { id: 2, years: 200000, rate: 20, roof: 8800 },
  { id: 3, years: 0, rate: 22, roof: 6000 },
];

describe("sortedSamples", () => {
  it("keeps the sampled order when not sorted", () => {
    expect(sortedSamples(samples, { key: null, direction: 1 }).map((s) => s.id)).toEqual([1, 2, 3]);
  });

  it("sorts ascending and descending by the key", () => {
    expect(sortedSamples(samples, { key: "years", direction: 1 }).map((s) => s.id)).toEqual([
      3, 1, 2,
    ]);
    expect(sortedSamples(samples, { key: "rate", direction: -1 }).map((s) => s.id)).toEqual([
      3, 2, 1,
    ]);
  });

  it("returns a copy and leaves the trial's order alone", () => {
    const sorted = sortedSamples(samples, { key: "roof", direction: 1 });
    expect(sorted.map((s) => s.id)).toEqual([1, 3, 2]);
    expect(sorted).not.toBe(samples);
    expect(samples.map((s) => s.id)).toEqual([1, 2, 3]);
  });
});
