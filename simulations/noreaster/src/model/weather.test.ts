import { describe, expect, it } from "vitest";
import {
  type AirMassSetup,
  deriveOceanTemperature,
  evaluateOutcome,
  type Humidity,
  type LandPathway,
  type OceanPathway,
  OUTCOME_BANNER,
  type Outcome,
} from "./weather";

// The one setup that yields a nor'easter: Cold + Dry land, S/SE + Humid ocean. Land pathway then
// splits strong (N/NW) vs moderate (W). Every other setup is fair.
const NOR_BASE: Omit<AirMassSetup, "landPathway"> = {
  landHumidity: "Dry",
  landTemperature: "Cold",
  oceanPathway: "S/SE",
  oceanHumidity: "Humid",
};

const LAND_PATHWAYS: LandPathway[] = ["N/NW", "W"];
const OCEAN_PATHWAYS: OceanPathway[] = ["S/SE", "NE"];
const HUMIDITIES: Humidity[] = ["Dry", "Humid"];

describe("evaluateOutcome", () => {
  it("returns 'strong' for N/NW land + Cold/Dry land + S/SE/Humid ocean", () => {
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW" })).toBe("strong");
  });

  it("returns 'moderate' for W land + Cold/Dry land + S/SE/Humid ocean", () => {
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "W" })).toBe("moderate");
  });

  it("falls back to 'fair' when any nor'easter condition is missing", () => {
    // Each of these flips exactly one field away from the strong setup.
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", landTemperature: "Warm" })).toBe(
      "fair",
    );
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", landHumidity: "Humid" })).toBe(
      "fair",
    );
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", oceanPathway: "NE" })).toBe("fair");
    expect(evaluateOutcome({ ...NOR_BASE, landPathway: "N/NW", oceanHumidity: "Dry" })).toBe(
      "fair",
    );
  });

  it("resolves all 32 possible setups to a defined outcome — exactly one strong, one moderate, rest fair", () => {
    const counts: Record<Outcome, number> = { strong: 0, moderate: 0, fair: 0 };
    let total = 0;
    for (const landPathway of LAND_PATHWAYS) {
      for (const landHumidity of HUMIDITIES) {
        for (const landTemperature of ["Cold", "Warm"] as const) {
          for (const oceanPathway of OCEAN_PATHWAYS) {
            for (const oceanHumidity of HUMIDITIES) {
              const outcome = evaluateOutcome({
                landPathway,
                landHumidity,
                landTemperature,
                oceanPathway,
                oceanHumidity,
              });
              expect(["strong", "moderate", "fair"]).toContain(outcome);
              counts[outcome]++;
              total++;
            }
          }
        }
      }
    }
    expect(total).toBe(32);
    expect(counts).toEqual({ strong: 1, moderate: 1, fair: 30 });
  });
});

describe("deriveOceanTemperature", () => {
  it("maps S/SE → Warm and NE → Cool, and null → null", () => {
    expect(deriveOceanTemperature("S/SE")).toBe("Warm");
    expect(deriveOceanTemperature("NE")).toBe("Cool");
    expect(deriveOceanTemperature(null)).toBeNull();
  });
});

describe("OUTCOME_BANNER", () => {
  it("labels every outcome (curly apostrophe in the nor'easter copy)", () => {
    expect(OUTCOME_BANNER).toEqual({
      strong: "Strong nor’easter",
      moderate: "Moderate nor’easter",
      fair: "Fair weather",
    });
  });
});
