import { describe, expect, it } from "vitest";
import {
  type AirMassSetup,
  deriveOceanTemperature,
  evaluateOutcome,
  HUMIDITIES,
  LAND_PATHWAYS,
  LAND_TEMPERATURES,
  OCEAN_PATHWAYS,
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

// The physical rules documented above `SETUP_OUTCOMES`, encoded independently as a test oracle. The
// table is a 32-row hand transcription, so its likeliest error is a transposed pair — which leaves the
// distribution intact and would pass a counts-only check. Asserting every row against these rules pins
// each one, catching that. (The oracle is the classification rationale; a deliberate non-rule
// reclassification would update both the table and this function.)
function oracle(setup: AirMassSetup): Outcome {
  const landColdDry = setup.landTemperature === "Cold" && setup.landHumidity === "Dry";
  const oceanHumid = setup.oceanHumidity === "Humid";
  const oceanWarm = setup.oceanPathway === "S/SE"; // S/SE (2) → warm Gulf Stream; NE (3) → cool
  if (landColdDry && oceanHumid && oceanWarm) {
    return setup.landPathway === "N/NW" ? "strong" : "moderate";
  }
  if (landColdDry && oceanHumid) return "weakCoastal";
  if (landColdDry) return "dryFront";
  if (oceanHumid && oceanWarm) return "humidNoStorm";
  return "fair";
}

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

  it("classifies every possible setup per the physical rules, with the approved distribution", () => {
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
              const setup: AirMassSetup = {
                landPathway,
                landHumidity,
                landTemperature,
                oceanPathway,
                oceanHumidity,
              };
              const outcome = evaluateOutcome(setup);
              // Primary: every row matches the rule oracle (pins all setups individually).
              expect(outcome, JSON.stringify(setup)).toBe(oracle(setup));
              counts[outcome]++;
              total++;
            }
          }
        }
      }
    }
    // The domain is the product of the real enumerations — grows automatically if one gains a value.
    expect(total).toBe(
      LAND_PATHWAYS.length *
        HUMIDITIES.length *
        LAND_TEMPERATURES.length *
        OCEAN_PATHWAYS.length *
        HUMIDITIES.length,
    );
    // Secondary: the approved distribution across the whole domain.
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
