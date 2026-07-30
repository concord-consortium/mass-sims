import { describe, expect, it } from "vitest";
import { SETUPS } from "../stores/test-helpers";
import { finalNarration, STAGED_NARRATION, startNarration } from "./run-narration";
import { TOTAL_DUR_S } from "./use-storm-run";

describe("startNarration", () => {
  it("describes both air masses converging", () => {
    expect(startNarration(SETUPS.strong, false)).toBe(
      "Running simulation, cold dry air mass from the N/NW and warm humid air mass from the S/SE converging",
    );
  });

  it("says Replaying on a replay", () => {
    expect(startNarration(SETUPS.strong, true)).toMatch(/^Replaying simulation, /);
  });

  it("uses the derived ocean temperature (NE → cool)", () => {
    expect(startNarration(SETUPS.weakCoastal, false)).toContain("cool humid air mass from the NE");
  });
});

describe("STAGED_NARRATION", () => {
  it("has non-empty, strictly-ordered, in-window lines for every outcome", () => {
    for (const outcome of Object.keys(STAGED_NARRATION) as (keyof typeof STAGED_NARRATION)[]) {
      const lines = STAGED_NARRATION[outcome];
      expect(lines.length).toBeGreaterThan(0);
      for (let i = 0; i < lines.length; i++) {
        expect(lines[i].atMs).toBeGreaterThanOrEqual(1500); // first line lands at cloud-start
        expect(lines[i].atMs).toBeLessThan(TOTAL_DUR_S[outcome] * 1000); // …and before the run finalizes
        expect(lines[i].text.length).toBeGreaterThan(0);
        if (i > 0) expect(lines[i].atMs).toBeGreaterThan(lines[i - 1].atMs);
      }
    }
  });

  it("names the storm strength in the growth line for strong / moderate", () => {
    expect(STAGED_NARRATION.strong[1].text).toContain("strong nor’easter");
    expect(STAGED_NARRATION.moderate[1].text).toContain("moderate nor’easter");
  });
});

describe("finalNarration", () => {
  it("reads out the full weather-outcome table", () => {
    const s = finalNarration("strong");
    expect(s).toContain("Weather Outcome: Strong nor’easter");
    expect(s).toContain("Sky: Overcast, storm clouds");
    expect(s).toContain("Wind: From the NE, 45–60 mph");
    expect(s).toContain("Storm Intensity: Strong");
  });
});
