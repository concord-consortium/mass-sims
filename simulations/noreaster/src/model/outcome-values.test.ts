import { describe, expect, it } from "vitest";
import {
  OUTCOME_BANNER,
  OUTCOME_METADATA,
  OUTCOME_VALUES,
  type OutcomeMetadata,
  type OutcomeValues,
} from "./outcome-values";
import { OUTCOMES } from "./weather";

const VALUES_FIELDS: (keyof OutcomeValues)[] = [
  "label",
  "sky",
  "pressure",
  "wind",
  "precipType",
  "precipAmount",
  "stormIntensity",
];
const METADATA_FIELDS: (keyof OutcomeMetadata)[] = ["coastalFlooding", "commaCloud"];

// The Record<Outcome, …> types already guarantee every outcome has a row and exactly the declared
// fields (missing/extra keys don't compile), so those aren't re-checked at runtime. What the types
// can't catch — an accidental empty string — is what these tests cover.
describe("OUTCOME_VALUES", () => {
  it("has a non-empty string for every displayed field of every outcome", () => {
    for (const outcome of OUTCOMES) {
      for (const field of VALUES_FIELDS) {
        const value = OUTCOME_VALUES[outcome][field];
        expect(typeof value, `${outcome}.${field}`).toBe("string");
        expect(value.trim().length, `${outcome}.${field}`).toBeGreaterThan(0);
      }
    }
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

describe("OUTCOME_BANNER", () => {
  it("pins the exact approved label for every outcome (curly apostrophes included)", () => {
    expect(OUTCOME_BANNER).toEqual({
      strong: "Strong nor’easter",
      moderate: "Moderate nor’easter",
      weakCoastal: "Weak coastal storm",
      humidNoStorm: "Humid, no storm",
      dryFront: "Dry front passes",
      fair: "Fair weather",
    });
  });

  it("equals each outcome's label (one label source, no drift)", () => {
    for (const outcome of OUTCOMES) {
      expect(OUTCOME_BANNER[outcome]).toBe(OUTCOME_VALUES[outcome].label);
    }
  });
});
