import { describe, expect, it } from "vitest";
import { END_YEAR, isCollapsed, roofErosionPct } from "./collapse";
import type { SimInput } from "./types";

const bowlingGreen: SimInput = {
  location: "bowling-green",
  wetness: "wet",
  soil: "limestone",
};
const louisville: SimInput = {
  location: "louisville",
  wetness: "wet",
  soil: "limestone",
};

describe("collapse model — locations", () => {
  it("Bowling Green collapses with wet + limestone, and its cave roof erodes", () => {
    expect(isCollapsed(bowlingGreen, END_YEAR)).toBe(true);
    expect(roofErosionPct(bowlingGreen, END_YEAR)).toBeGreaterThan(0);
  });

  it("Louisville never collapses and has no cave-roof erosion, even wet + limestone", () => {
    expect(isCollapsed(louisville, END_YEAR)).toBe(false);
    expect(roofErosionPct(louisville, END_YEAR)).toBe(0);
  });
});
