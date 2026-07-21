import { describe, expect, it } from "vitest";
import {
  type AirMassSetup,
  deriveOceanTemperature,
  evaluateOutcome,
  type Humidity,
  type LandPathway,
  type LandTemperature,
  type OceanPathway,
  OUTCOMES,
  type Outcome,
} from "./weather";

// The Cold + Dry land, S/SE + Humid ocean base — the nor'easter setup. Land pathway then splits
// strong (N/NW) vs moderate (W).
const NOR_BASE: Omit<AirMassSetup, "landPathway"> = {
  landHumidity: "Dry",
  landTemperature: "Cold",
  oceanPathway: "S/SE",
  oceanHumidity: "Humid",
};

const LAND_PATHWAYS: LandPathway[] = ["N/NW", "W"];
const OCEAN_PATHWAYS: OceanPathway[] = ["S/SE", "NE"];
const HUMIDITIES: Humidity[] = ["Dry", "Humid"];
const LAND_TEMPERATURES: LandTemperature[] = ["Cold", "Warm"];

describe("OUTCOMES", () => {
  it("lists the six outcomes in the approved display order", () => {
    expect([...OUTCOMES]).toEqual([
      "strong",
      "moderate",
      "weakCoastal",
      "humidNoStorm",
      "dryFront",
      "fair",
    ]);
  });
});

describe("evaluateOutcome", () => {
  it("returns 'strong' for N/NW land + Cold/Dry land + S/SE/Humid ocean", () => {
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW" })).toBe("strong");
  });

  it("returns 'moderate' for W land + Cold/Dry land + S/SE/Humid ocean", () => {
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "W" })).toBe("moderate");
  });

  it("returns 'weakCoastal' for Cold/Dry land + NE/Humid ocean (either land pathway)", () => {
    // Ocean route 3 (NE, cool) instead of 2 (S/SE, warm), Humid: a weak coastal storm, not a nor'easter.
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", oceanPathway: "NE" })).toBe(
      "weakCoastal",
    );
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "W", oceanPathway: "NE" })).toBe(
      "weakCoastal",
    );
  });

  it("returns 'dryFront' for Cold/Dry land + a Dry ocean (no moisture to work with)", () => {
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", oceanHumidity: "Dry" })).toBe(
      "dryFront",
    );
    expect(
      evaluateOutcome({
        ...NOR_BASE,
        landPathway: "N/NW",
        oceanPathway: "NE",
        oceanHumidity: "Dry",
      }),
    ).toBe("dryFront");
  });

  it("returns 'humidNoStorm' for a not-Cold/Dry land + S/SE/Humid ocean", () => {
    // Warm or Humid land (so not the cold, dry air mass a storm needs) meeting the warm humid ocean.
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", landHumidity: "Humid" })).toBe(
      "humidNoStorm",
    );
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", landTemperature: "Warm" })).toBe(
      "humidNoStorm",
    );
  });

  it("returns 'fair' for a not-Cold/Dry land + a not-warm-humid ocean", () => {
    expect(
      evaluateOutcome({
        landPathway: "N/NW",
        landHumidity: "Humid",
        landTemperature: "Warm",
        oceanPathway: "NE",
        oceanHumidity: "Dry",
      }),
    ).toBe("fair");
  });

  it("resolves all 32 possible setups to one of the six outcomes with the approved distribution", () => {
    const counts: Record<Outcome, number> = {
      strong: 0,
      moderate: 0,
      weakCoastal: 0,
      humidNoStorm: 0,
      dryFront: 0,
      fair: 0,
    };
    let total = 0;
    for (const landPathway of LAND_PATHWAYS) {
      for (const landHumidity of HUMIDITIES) {
        for (const landTemperature of LAND_TEMPERATURES) {
          for (const oceanPathway of OCEAN_PATHWAYS) {
            for (const oceanHumidity of HUMIDITIES) {
              const outcome = evaluateOutcome({
                landPathway,
                landHumidity,
                landTemperature,
                oceanPathway,
                oceanHumidity,
              });
              expect(OUTCOMES).toContain(outcome);
              counts[outcome]++;
              total++;
            }
          }
        }
      }
    }
    expect(total).toBe(32);
    expect(counts).toEqual({
      strong: 1,
      moderate: 1,
      weakCoastal: 2,
      humidNoStorm: 6,
      dryFront: 4,
      fair: 18,
    });
  });
});

describe("deriveOceanTemperature", () => {
  it("maps S/SE → Warm and NE → Cool, and null → null", () => {
    expect(deriveOceanTemperature("S/SE")).toBe("Warm");
    expect(deriveOceanTemperature("NE")).toBe("Cool");
    expect(deriveOceanTemperature(null)).toBeNull();
  });
});
