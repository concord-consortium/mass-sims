// Mendelian genetics engine: pure (no React, no side effects). One gene, two alleles —
// R (resistant, dominant) and r (not resistant, recessive).

export const OFFSPRING_MIN = 5;
export const OFFSPRING_MAX = 20;
export const MAX_CROSSES = 6;

export type Allele = "R" | "r";
export type Genotype = readonly [Allele, Allele];

export type ParentId = "wild-w1" | "wild-w2" | "wild-w3" | "cavendish-c1" | "cavendish-c2";

export const PARENT_GENOTYPES: Record<ParentId, Genotype> = {
  "wild-w1": ["R", "r"],
  "wild-w2": ["R", "R"],
  "wild-w3": ["R", "r"],
  "cavendish-c1": ["r", "r"],
  "cavendish-c2": ["r", "r"],
};

/** Display label per parent variety. */
export const PARENT_LABELS: Record<ParentId, string> = {
  "wild-w1": "Wild W1",
  "wild-w2": "Wild W2",
  "wild-w3": "Wild W3",
  "cavendish-c1": "Cavendish C1",
  "cavendish-c2": "Cavendish C2",
};

export interface OffspringPlant {
  /** Diploid genotype in draw order, e.g. "Rr" (both "Rr" and "rR" occur). */
  genotype: string;
  /** R is dominant, so only rr is susceptible. */
  isResistant: boolean;
  /** True only when fungus is active and the plant is non-resistant. */
  infected: boolean;
}

/** Pick one of the genotype's two alleles, 50/50. */
export function pickAllele(genotype: Genotype, rng: () => number = Math.random): Allele {
  return genotype[Math.floor(rng() * 2)];
}

export function makeOffspring(
  p1: ParentId,
  p2: ParentId,
  fungusActive: boolean,
  rng: () => number = Math.random,
): OffspringPlant {
  const a1 = pickAllele(PARENT_GENOTYPES[p1], rng);
  const a2 = pickAllele(PARENT_GENOTYPES[p2], rng);
  const isResistant = a1 === "R" || a2 === "R";
  return {
    genotype: a1 + a2,
    isResistant,
    infected: fungusActive && !isResistant,
  };
}

/** Build a cross of OFFSPRING_MIN–OFFSPRING_MAX offspring. */
export function makeCross(
  p1: ParentId,
  p2: ParentId,
  fungusActive: boolean,
  rng: () => number = Math.random,
): OffspringPlant[] {
  const count = OFFSPRING_MIN + Math.floor(rng() * (OFFSPRING_MAX - OFFSPRING_MIN + 1));
  const plants: OffspringPlant[] = [];
  for (let i = 0; i < count; i++) {
    plants.push(makeOffspring(p1, p2, fungusActive, rng));
  }
  return plants;
}
