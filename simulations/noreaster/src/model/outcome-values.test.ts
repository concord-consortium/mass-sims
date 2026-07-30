import { describe, expect, it } from "vitest";
import { OUTCOME_METADATA, OUTCOME_VALUES, type OutcomeMetadata } from "./outcome-values";
import { OUTCOMES } from "./weather";

const METADATA_FIELDS: (keyof OutcomeMetadata)[] = ["coastalFlooding", "commaCloud", "pressure"];

// The Record<Outcome, …> types already guarantee every outcome has a row with exactly the declared
// fields (missing/extra keys don't compile). These tests cover what the types can't: the exact approved
// display strings — a wrong glyph (a hyphen for an en-dash, a straight apostrophe) would still compile —
// and non-empty metadata.
describe("OUTCOME_VALUES", () => {
  it("pins the exact approved displayed values for every outcome (verbatim glyphs)", () => {
    expect(OUTCOME_VALUES).toEqual({
      strong: {
        label: "Strong nor’easter",
        sky: "Overcast, storm clouds",
        wind: "From the NE, 45–60 mph",
        precipType: "Rain (snow inland)",
        precipAmount: "Heavy",
        stormIntensity: "Strong",
      },
      moderate: {
        label: "Moderate nor’easter",
        sky: "Overcast, storm clouds",
        wind: "From the NE, 25–35 mph",
        precipType: "Rain (mix inland)",
        precipAmount: "Moderate",
        stormIntensity: "Moderate",
      },
      weakCoastal: {
        label: "Weak coastal storm",
        sky: "Cloudy",
        wind: "From the NE, 15–20 mph",
        precipType: "Light rain / wet snow",
        precipAmount: "Light",
        stormIntensity: "Weak",
      },
      humidNoStorm: {
        label: "Humid, no storm",
        sky: "Overcast, hazy",
        wind: "From the S/SE, 5–15 mph",
        precipType: "Scattered rain",
        precipAmount: "Trace",
        stormIntensity: "None",
      },
      windy: {
        label: "Windy, no storm",
        sky: "Clear, breezy",
        wind: "From the NW, 15–25 mph",
        precipType: "None",
        precipAmount: "None",
        stormIntensity: "None",
      },
      fair: {
        label: "Fair weather",
        sky: "Sunny",
        wind: "Variable, 0–10 mph",
        precipType: "None",
        precipAmount: "None",
        stormIntensity: "None",
      },
    });
  });
});

describe("OUTCOME_METADATA", () => {
  it("has a non-empty string for every metadata field of every outcome", () => {
    for (const outcome of OUTCOMES) {
      for (const field of METADATA_FIELDS) {
        const value = OUTCOME_METADATA[outcome][field];
        expect(typeof value, `${outcome}.${field}`).toBe("string");
        expect(value.trim().length, `${outcome}.${field}`).toBeGreaterThan(0);
      }
    }
  });
});
