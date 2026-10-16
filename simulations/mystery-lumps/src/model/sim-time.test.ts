import { describe, expect, it } from "vitest";
import { formatSimTime, simDurationSeconds } from "./sim-time";

describe("simDurationSeconds", () => {
  it("gives the three bench tests two minutes each", () => {
    for (const test of ["water", "vinegar", "bath"] as const) {
      expect(simDurationSeconds(test, null)).toBe(120);
    }
    // The bath's dial changes the temperature, not how long it sits there.
    expect(simDurationSeconds("bath", "80")).toBe(120);
  });

  it("runs the lamp for exactly the exposure that was dialled in", () => {
    expect(simDurationSeconds("lamp", "hour")).toBe(3600);
    expect(simDurationSeconds("lamp", "day")).toBe(86400);
    expect(simDurationSeconds("lamp", "fortnight")).toBe(1209600);
    // Each step up the dial is a longer span than the one below it.
    const spans = (["seconds", "hour", "day", "fortnight"] as const).map((e) =>
      simDurationSeconds("lamp", e),
    );
    expect(spans).toEqual([...spans].sort((a, b) => a - b));
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
