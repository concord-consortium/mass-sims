export type SubstanceId = "seashell" | "sea-salt" | "sea-glass" | "palm-oil" | "paraffin";
export type LumpId = "A" | "B" | "C" | "D" | "E";

export const LUMP_IDS = ["A", "B", "C", "D", "E"] as const satisfies readonly LumpId[];

/**
 * The same five lumps for every student, so a class can say "lump C" and mean one thing.
 * Scrambled relative to how the substances are listed anywhere else, so the order itself
 * gives nothing away.
 */
export const LUMP_ASSIGNMENT: Record<LumpId, SubstanceId> = {
  A: "paraffin",
  B: "sea-salt",
  C: "sea-glass",
  D: "palm-oil",
  E: "seashell",
};
