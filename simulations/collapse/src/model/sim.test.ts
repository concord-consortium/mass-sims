import { describe, expect, it } from "vitest";
import {
  COLLAPSE_SPAN_YEARS,
  SAMPLE_YEARS_BEFORE,
  stepSampleYear,
  timelinePosition,
  YEARS_SINCE_COLLAPSE,
  yearsAgoAtPosition,
  yearsBeforeAtPosition,
} from "./sim";

describe("timeline position <-> years mapping", () => {
  it("yearsAgoAtPosition inverts timelinePosition", () => {
    for (const yearsAgo of [50, 1_000, 12_000, 100_000]) {
      const roundTrip = yearsAgoAtPosition(timelinePosition(yearsAgo));
      expect(roundTrip).toBeCloseTo(yearsAgo, 0);
    }
  });

  it("yearsBeforeAtPosition inverts the sample-marker placement", () => {
    // The sample marker for `yearsBefore` sits at timelinePosition(yearsBefore + YEARS_SINCE_COLLAPSE).
    for (const yearsBefore of [0, 1_000, 50_000, COLLAPSE_SPAN_YEARS]) {
      const pos = timelinePosition(yearsBefore + YEARS_SINCE_COLLAPSE);
      expect(yearsBeforeAtPosition(pos)).toBe(yearsBefore);
    }
  });

  it("clamps to the samplable span at the track edges", () => {
    expect(yearsBeforeAtPosition(1)).toBe(0); // far right / most recent
    expect(yearsBeforeAtPosition(0)).toBe(COLLAPSE_SPAN_YEARS); // far left / oldest
    expect(yearsBeforeAtPosition(-0.5)).toBe(COLLAPSE_SPAN_YEARS);
    expect(yearsBeforeAtPosition(1.5)).toBe(0);
  });

  it("snaps clicks to the log-spaced sample grid", () => {
    for (const pos of [0.1, 0.37, 0.62, 0.9]) {
      expect(SAMPLE_YEARS_BEFORE).toContain(yearsBeforeAtPosition(pos));
    }
  });
});

describe("stepSampleYear", () => {
  it("moves one grid slot per step, in log-spaced increments", () => {
    expect(stepSampleYear(0, 1)).toBe(10); // fine steps near the present
    expect(stepSampleYear(1_000, 1)).toBe(2_000); // coarser steps further back
    expect(stepSampleYear(2_000, -1)).toBe(1_000);
  });

  it("clamps at the grid ends", () => {
    expect(stepSampleYear(0, -1)).toBe(0);
    expect(stepSampleYear(COLLAPSE_SPAN_YEARS, 1)).toBe(COLLAPSE_SPAN_YEARS);
  });

  it("steps from an off-grid value to the adjacent grid slot", () => {
    // 3,000 is between 2,000 and 5,000 (nearest is 2,000); stepping older lands on 5,000.
    expect(stepSampleYear(3_000, 1)).toBe(5_000);
  });
});
