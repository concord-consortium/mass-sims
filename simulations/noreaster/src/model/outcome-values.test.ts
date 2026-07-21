import { describe, expect, it } from "vitest";
import {
  OUTCOME_BANNER,
  OUTCOME_METADATA,
  OUTCOME_VALUES,
  type OutcomeMetadata,
  type OutcomeValues,
} from "./outcome-values";
import { OUTCOMES, type Outcome } from "./weather";

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

describe("OUTCOME_VALUES", () => {
  it("has a row for every outcome and no extra keys", () => {
    expect(Object.keys(OUTCOME_VALUES).sort()).toEqual([...OUTCOMES].sort());
  });

  it("has exactly the displayed fields — no missing, no extra — for every outcome", () => {
    for (const outcome of OUTCOMES) {
      expect(Object.keys(OUTCOME_VALUES[outcome]).sort(), outcome).toEqual(
        [...VALUES_FIELDS].sort(),
      );
    }
  });

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
  it("has a row for every outcome and no extra keys", () => {
    expect(Object.keys(OUTCOME_METADATA).sort()).toEqual([...OUTCOMES].sort());
  });

  it("has exactly the metadata fields — no missing, no extra — for every outcome", () => {
    for (const outcome of OUTCOMES) {
      expect(Object.keys(OUTCOME_METADATA[outcome]).sort(), outcome).toEqual(
        [...METADATA_FIELDS].sort(),
      );
    }
  });

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
  it("has a banner for every outcome and no extra keys", () => {
    expect(Object.keys(OUTCOME_BANNER).sort()).toEqual([...OUTCOMES].sort());
  });

  it("equals each outcome's label (one label source, no drift)", () => {
    for (const outcome of OUTCOMES as readonly Outcome[]) {
      expect(OUTCOME_BANNER[outcome]).toBe(OUTCOME_VALUES[outcome].label);
    }
  });
});
