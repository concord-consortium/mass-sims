export type SubstanceId = "seashell" | "sea-salt" | "sea-glass" | "palm-oil" | "paraffin";
export type LumpId = "1" | "2" | "3" | "4" | "5";

export const LUMP_IDS = ["1", "2", "3", "4", "5"] as const satisfies readonly LumpId[];

/**
 * The same five lumps for every student, so a class can say "lump 3" and mean one thing.
 * Scrambled relative to how the substances are listed anywhere else, so the order itself
 * gives nothing away.
 */
export const LUMP_ASSIGNMENT: Record<LumpId, SubstanceId> = {
  "1": "paraffin",
  "2": "sea-salt",
  "3": "sea-glass",
  "4": "palm-oil",
  "5": "seashell",
};

/** g/cm³. Sea glass is soda-lime glass, which is why it matches the shell. */
const DENSITY: Record<SubstanceId, number> = {
  paraffin: 0.9,
  "sea-salt": 2.17,
  "sea-glass": 2.5,
  "palm-oil": 0.89,
  seashell: 2.5,
};

/**
 * cm³, each roughly a 5–7 × 3 × 2 cm piece. The sizes differ on purpose: with equal volumes the
 * starting mass alone would rank the densities and split the salt from the hard pair for free.
 * Mass only becomes evidence when it changes.
 */
const VOLUME: Record<LumpId, number> = { "1": 38, "2": 31, "3": 34, "4": 40, "5": 36 };

/** Grams, to the scale's 0.1 g. */
export function startingMass(lump: LumpId): number {
  return Math.round(DENSITY[LUMP_ASSIGNMENT[lump]] * VOLUME[lump] * 10) / 10;
}
