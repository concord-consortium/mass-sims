import { resetSeededRandom, seededRandom } from "@concord-consortium/mass-sims-shared";
import { describe, expect, it } from "vitest";
import {
  makeCross,
  makeOffspring,
  OFFSPRING_MAX,
  OFFSPRING_MIN,
  PARENT_GENOTYPES,
  PARENT_LABELS,
  type ParentId,
  pickAllele,
} from "./genetics";

const W1: ParentId = "wild-w1";
const W2: ParentId = "wild-w2";
const C1: ParentId = "cavendish-c1";
const C2: ParentId = "cavendish-c2";

describe("pickAllele", () => {
  it("returns the first allele when rng() < 0.5 and the second when rng() >= 0.5", () => {
    expect(pickAllele(["R", "r"], () => 0.2)).toBe("R");
    expect(pickAllele(["R", "r"], () => 0.7)).toBe("r");
    // Boundary: 0.5 maps to index 1 (the second allele).
    expect(pickAllele(["R", "r"], () => 0.5)).toBe("r");
  });
});

describe("makeOffspring", () => {
  it("W2 x C1 always produces Rr and is resistant", () => {
    for (let i = 0; i < 25; i++) {
      const o = makeOffspring(W2, C1, false);
      expect(o.genotype).toBe("Rr");
      expect(o.isResistant).toBe(true);
    }
  });

  it("C1 x C2 always produces rr and is not resistant", () => {
    for (let i = 0; i < 25; i++) {
      const o = makeOffspring(C1, C2, false);
      expect(o.genotype).toBe("rr");
      expect(o.isResistant).toBe(false);
    }
  });

  it("W1 x C1 yields Rr/resistant or rr/non-resistant depending on the W1 draw", () => {
    // W1 = ["R","r"], C1 = ["r","r"]. rng < 0.5 draws R from W1; rng >= 0.5 draws r.
    const rr1 = makeOffspring(W1, C1, false, () => 0.2);
    expect(rr1.genotype).toBe("Rr");
    expect(rr1.isResistant).toBe(true);

    const rr2 = makeOffspring(W1, C1, false, () => 0.7);
    expect(rr2.genotype).toBe("rr");
    expect(rr2.isResistant).toBe(false);
  });

  it("with fungusActive=true, non-resistant offspring are infected and resistant ones are not", () => {
    const infected = makeOffspring(W1, C1, true, () => 0.7); // rr, non-resistant
    expect(infected.isResistant).toBe(false);
    expect(infected.infected).toBe(true);

    const healthy = makeOffspring(W1, C1, true, () => 0.2); // Rr, resistant
    expect(healthy.isResistant).toBe(true);
    expect(healthy.infected).toBe(false);
  });

  it("with fungusActive=false, no offspring is infected even when non-resistant", () => {
    const o = makeOffspring(W1, C1, false, () => 0.7); // rr, non-resistant
    expect(o.isResistant).toBe(false);
    expect(o.infected).toBe(false);
  });
});

describe("makeCross", () => {
  it("returns OFFSPRING_MIN..OFFSPRING_MAX plants and spans the full size range over 200 calls", () => {
    resetSeededRandom("size");
    const rng = seededRandom("size");
    const sizes: number[] = [];
    for (let i = 0; i < 200; i++) {
      const cross = makeCross(W1, C1, false, rng);
      expect(cross.length).toBeGreaterThanOrEqual(OFFSPRING_MIN);
      expect(cross.length).toBeLessThanOrEqual(OFFSPRING_MAX);
      sizes.push(cross.length);
    }
    // Spans the full inclusive range and touches many distinct values, not stuck at a boundary.
    expect(Math.min(...sizes)).toBe(OFFSPRING_MIN);
    expect(Math.max(...sizes)).toBe(OFFSPRING_MAX);
    expect(new Set(sizes).size).toBeGreaterThan(8);
  });

  it("with fungusActive=true, every plant's infected flag equals !isResistant", () => {
    resetSeededRandom("fungus-on");
    const rng = seededRandom("fungus-on");
    for (let i = 0; i < 50; i++) {
      for (const plant of makeCross(W1, C1, true, rng)) {
        expect(plant.infected).toBe(!plant.isResistant);
      }
    }
  });

  it("with fungusActive=false, every plant is uninfected", () => {
    resetSeededRandom("fungus-off");
    const rng = seededRandom("fungus-off");
    for (let i = 0; i < 50; i++) {
      for (const plant of makeCross(W1, C1, false, rng)) {
        expect(plant.infected).toBe(false);
      }
    }
  });

  it("W1 x W1 produces RR:Rr:rr in ~1:2:1 over 10,000 plants (fixed seed)", () => {
    resetSeededRandom("ratio-W1xW1");
    const rng = seededRandom("ratio-W1xW1");
    const plants = [];
    while (plants.length < 10000) {
      plants.push(...makeCross(W1, W1, false, rng));
    }
    const n = plants.length;
    let rrHom = 0;
    let het = 0;
    let rrRec = 0;
    for (const p of plants) {
      const rCount = (p.genotype.match(/R/g) ?? []).length;
      if (rCount === 2) rrHom++;
      else if (rCount === 1) het++;
      else rrRec++;
    }
    const tol = 0.025 * n;
    expect(rrHom).toBeGreaterThan(0.25 * n - tol);
    expect(rrHom).toBeLessThan(0.25 * n + tol);
    expect(het).toBeGreaterThan(0.5 * n - tol);
    expect(het).toBeLessThan(0.5 * n + tol);
    expect(rrRec).toBeGreaterThan(0.25 * n - tol);
    expect(rrRec).toBeLessThan(0.25 * n + tol);
  });

  it("W1 x C1 produces Rr:rr in ~1:1 over 10,000 plants (fixed seed)", () => {
    resetSeededRandom("ratio-W1xC1");
    const rng = seededRandom("ratio-W1xC1");
    const plants = [];
    while (plants.length < 10000) {
      plants.push(...makeCross(W1, C1, false, rng));
    }
    const n = plants.length;
    const resistant = plants.filter((p) => p.isResistant).length;
    const rr = n - resistant;
    const tol = 0.025 * n;
    expect(resistant).toBeGreaterThan(0.5 * n - tol);
    expect(resistant).toBeLessThan(0.5 * n + tol);
    expect(rr).toBeGreaterThan(0.5 * n - tol);
    expect(rr).toBeLessThan(0.5 * n + tol);
  });

  it("advances the PRNG across sequential calls but replays byte-identically after reset", () => {
    resetSeededRandom("det");
    const first = makeCross(W1, C1, false, seededRandom("det"));
    const second = makeCross(W1, C1, false, seededRandom("det"));
    // Same cached PRNG instance advanced between calls → different draws.
    expect(second).not.toEqual(first);

    resetSeededRandom("det");
    const replay = makeCross(W1, C1, false, seededRandom("det"));
    expect(replay).toEqual(first);
  });
});

describe("PARENT_LABELS", () => {
  // Guards against drift between the engine and the UI catalog: every parent has both a
  // genotype and a label.
  it("has exactly the same keys as PARENT_GENOTYPES", () => {
    expect(Object.keys(PARENT_LABELS).sort()).toEqual(Object.keys(PARENT_GENOTYPES).sort());
  });
});
