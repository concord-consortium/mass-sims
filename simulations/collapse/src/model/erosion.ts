import type { Moisture, RockType } from "../trial-conditions";

export interface Conditions {
  rock: RockType;
  moisture: Moisture;
}

/**
 * Base erosion rate in mm per 1,000 years, from the earlier Collapse mock
 * (models-resources.concord.org/mass-sims/branch/collapseMock/collapse/). Granite is a flat 2 with
 * no weather term: rock type and weather only interact for limestone.
 */
export const ROCK_MODEL: Record<RockType, Record<Moisture, { baseRate: number }>> = {
  Limestone: { Wet: { baseRate: 30 }, Dry: { baseRate: 20 } },
  Granite: { Wet: { baseRate: 2 }, Dry: { baseRate: 2 } },
};

/**
 * Erosion is counted from 200,000 years before the collapse, so even the earliest sample on the
 * timeline starts from here.
 */
export const EROSION_START_YEARS = 200000;

/**
 * The rock above the cave at the start, in mm. It comes from the real site: the National Corvette
 * Museum sinkhole was 30–35 ft deep, and here the hole bottoms out on the cave floor, so sinkhole
 * depth = soil + roof = roof × 1.1207. A roof of 8,800 mm gives 9,862 mm = 32.4 ft, mid-range.
 */
export const CAVE_ROOF_START = 8800;

/**
 * The roof fails at or below this, in mm. It is forced by the other two numbers, not chosen: wet
 * limestone removes 30 / 1,000 × 200,000 = 6,000 mm over the run, and 8,800 − 6,000 = 2,800, so
 * only limestone + wet fails, and only at year 0. Roofs fail with meters still standing, which is
 * why the threshold is not zero.
 */
export const CAVE_ROOF_FAIL = 2800;

/**
 * The reported rate scatters ±15% per sample; the roof uses the base rate. The scatter is what
 * makes sampling the same year twice worth doing. The two columns therefore do not reconcile
 * (kept on purpose; set this to 0 to make them).
 *
 * Never apply the jitter to the roof: the roof would then change every time the same year is
 * sampled, and at ±15% the limestone-wet collapse would fire only about half the time. A dependable
 * collapse needs a deterministic roof.
 */
export const RATE_JITTER = 0.15;

/** The rock above the cave at `years` before collapse, in mm. Deterministic. */
export function roofAt(conditions: Conditions, years: number): number {
  const { baseRate } = ROCK_MODEL[conditions.rock][conditions.moisture];
  const elapsed = Math.max(0, EROSION_START_YEARS - years);
  const depth = (baseRate / 1000) * elapsed;
  return Math.max(0, CAVE_ROOF_START - depth);
}

/** One sample: a jittered rate and the deterministic roof. `rng` returns values in [0, 1). */
export function sampleAt(
  conditions: Conditions,
  years: number,
  rng: () => number,
): { years: number; rate: number; roof: number } {
  const { baseRate } = ROCK_MODEL[conditions.rock][conditions.moisture];
  const rate = baseRate * (1 + (rng() * 2 - 1) * RATE_JITTER);
  return { years, rate, roof: roofAt(conditions, years) };
}

export function isCollapsed(roof: number): boolean {
  return roof <= CAVE_ROOF_FAIL;
}

/** A whole number with thousands separators, for the table's cells. */
export function formatWhole(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
