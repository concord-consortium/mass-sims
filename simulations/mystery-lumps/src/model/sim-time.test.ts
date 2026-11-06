import { describe, expect, it } from "vitest";
import { formatSimTime, simDurationSeconds } from "./sim-time";

describe("simDurationSeconds", () => {
  it("gives water and vinegar two minutes, and the bath two at each of its three steps", () => {
    for (const test of ["water", "vinegar"] as const) {
      expect(simDurationSeconds(test)).toBe(120);
    }
    expect(simDurationSeconds("bath")).toBe(360);
  });

  it("always runs the lamp for two weeks", () => {
    expect(simDurationSeconds("lamp")).toBe(1209600);
  });
});

describe("formatSimTime", () => {
  it("picks the unit a person would say it in", () => {
    expect(formatSimTime(45)).toBe("45 s");
    expect(formatSimTime(120)).toBe("2 min");
    expect(formatSimTime(3600)).toBe("1 h");
    expect(formatSimTime(1209600)).toBe("14 d");
  });

  it("rounds up at the end of a run rather than reading one short", () => {
    // The meter asks for the elapsed time at 99.9%, which must not render as "1 min".
    expect(formatSimTime(120 * 0.999)).toBe("2 min");
  });
});
