import { describe, expect, it } from "vitest";
import {
  currentYear,
  formatYears,
  segmentsFor,
  TIMELINE_SEGMENTS,
  TIMELINE_STOPS,
  TIMELINE_VALUES,
  type TimelineStop,
} from "./timeline";

const anchors = TIMELINE_STOPS.filter((s) => s.years !== null);

describe("timeline data", () => {
  it("has sixteen descending values bracketed by the first and last anchor", () => {
    expect(TIMELINE_VALUES).toHaveLength(16);
    for (let i = 1; i < TIMELINE_VALUES.length; i++) {
      expect(TIMELINE_VALUES[i]).toBeLessThan(TIMELINE_VALUES[i - 1]);
    }
    expect(TIMELINE_VALUES[0]).toBe(anchors[0].years);
    expect(TIMELINE_VALUES.at(-1)).toBe(anchors.at(-1)?.years);
  });

  it("ends with the current-year marker, which has no fixed label", () => {
    const last = TIMELINE_STOPS.at(-1);
    expect(last?.years).toBeNull();
    expect(last?.yearLabel).toBeUndefined();
  });

  it("maps every value to a segment with t in [0, 1]", () => {
    expect(TIMELINE_SEGMENTS).toHaveLength(TIMELINE_VALUES.length);
    for (const seg of TIMELINE_SEGMENTS) {
      expect(seg.hi).toBeGreaterThanOrEqual(0);
      expect(seg.hi).toBeLessThan(anchors.length - 1);
      expect(seg.t).toBeGreaterThanOrEqual(0);
      expect(seg.t).toBeLessThanOrEqual(1);
    }
  });

  it("puts 150,000 halfway between 200,000 and 100,000", () => {
    expect(TIMELINE_SEGMENTS[TIMELINE_VALUES.indexOf(150000)]).toEqual({ hi: 0, t: 0.5 });
  });

  it("spaces the six values between 4,600 and 20 evenly (the >20× rule)", () => {
    const hi = anchors.findIndex((s) => s.years === 4600);
    const inner = [2000, 1000, 500, 200, 100, 50];
    inner.forEach((v, k) => {
      const seg = TIMELINE_SEGMENTS[TIMELINE_VALUES.indexOf(v)];
      expect(seg.hi).toBe(hi);
      expect(seg.t).toBeCloseTo((k + 1) / 7);
    });
  });

  it("places values by elapsed time within a narrow stretch", () => {
    const stops: TimelineStop[] = [
      { years: 100, at: 0, eventLines: [], end: false },
      { years: 50, at: 1, eventLines: [], end: false },
    ];
    expect(segmentsFor([100, 90, 50], stops)).toEqual([
      { hi: 0, t: 0 },
      { hi: 0, t: 0.2 },
      { hi: 0, t: 1 },
    ]);
  });

  it("reads the calendar year from the date it is given", () => {
    expect(currentYear(new Date("2027-01-01T12:00:00"))).toBe(2027);
  });

  it("formats values with grouping", () => {
    expect(formatYears(150000)).toBe("150,000");
    expect(formatYears(0)).toBe("0");
  });
});
