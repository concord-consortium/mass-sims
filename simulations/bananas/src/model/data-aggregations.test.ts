import { resetSeededRandom, seededRandom } from "@concord-consortium/mass-sims-shared";
import { describe, expect, it } from "vitest";
import { aggregateTotals, computeResistanceSeries } from "./data-aggregations";
import type { OffspringPlant } from "./genetics";

// Only `infected` matters for aggregation; genotype / isResistant are filled with plausible
// values so the fixtures are valid OffspringPlants.
function plant(infected: boolean): OffspringPlant {
  return { genotype: infected ? "rr" : "Rr", isResistant: !infected, infected };
}

const healthy = () => plant(false);
const infected = () => plant(true);

describe("aggregateTotals", () => {
  it("returns { healthy: 0, infected: 0 } for an empty array", () => {
    expect(aggregateTotals([])).toEqual({ healthy: 0, infected: 0 });
  });

  it("counts healthy and infected plants in a single cross", () => {
    expect(aggregateTotals([[healthy(), infected()]])).toEqual({ healthy: 1, infected: 1 });
  });

  it("sums across a multi-cross fixture", () => {
    const crosses = [
      [healthy(), healthy(), infected()],
      [infected(), infected()],
      [healthy(), healthy(), healthy(), infected()],
    ];
    expect(aggregateTotals(crosses)).toEqual({ healthy: 5, infected: 4 });
  });
});

describe("computeResistanceSeries", () => {
  it("returns { healthy: [], infected: [] } for an empty array", () => {
    expect(computeResistanceSeries([])).toEqual({ healthy: [], infected: [] });
  });

  it("rounds consistent with Math.round (2 healthy, 1 infected → 67% / 33%)", () => {
    // Math.round(66.6…) === 67.
    expect(computeResistanceSeries([[healthy(), healthy(), infected()]])).toEqual({
      healthy: [67],
      infected: [33],
    });
  });

  it("handles the exact 0.5 rounding boundary (Math.round, not banker's rounding)", () => {
    // (1 healthy, 1 infected) → 50% / 50%.
    expect(computeResistanceSeries([[healthy(), infected()]])).toEqual({
      healthy: [50],
      infected: [50],
    });
    // (3 healthy, 7 infected) → 30% / 70%.
    const cross = [healthy(), healthy(), healthy(), ...Array.from({ length: 7 }, infected)];
    expect(computeResistanceSeries([cross])).toEqual({ healthy: [30], infected: [70] });
  });

  it("keeps healthy[i] + infected[i] === 100 across a randomized fixture", () => {
    resetSeededRandom("resistance-invariant");
    const rng = seededRandom("resistance-invariant");
    const crosses: OffspringPlant[][] = [];
    for (let c = 0; c < 25; c++) {
      const count = 1 + Math.floor(rng() * 20);
      const cross: OffspringPlant[] = [];
      for (let i = 0; i < count; i++) {
        cross.push(plant(rng() < 0.5));
      }
      crosses.push(cross);
    }
    const series = computeResistanceSeries(crosses);
    expect(series.healthy).toHaveLength(25);
    series.healthy.forEach((h, i) => {
      expect(h + series.infected[i]).toBe(100);
    });
  });

  it("treats an empty cross as 100% healthy / 0% infected (defensive NaN-guard)", () => {
    // makeCross never produces a zero-plant cross; this asserts we return a safe default
    // rather than NaN if a future bug ever does.
    expect(computeResistanceSeries([[]])).toEqual({ healthy: [100], infected: [0] });
  });
});
