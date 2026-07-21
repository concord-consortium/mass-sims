// Weather-outcome model: pure (no React, no MST, no side effects). Maps a completed air-mass setup to
// a weather outcome, data-driven: classification AND the displayed values are data, not code. The
// stable seam the rest of the sim depends on is the `evaluateOutcome(setup)` API.
//
// This file owns the CLASSIFIER (setup → outcome). The OUTPUTS (outcome → Data-panel values +
// metadata) live in `outcome-values.ts`; consumers import from whichever they need. The two files have
// no runtime coupling — `outcome-values.ts` only imports the `Outcome` TYPE from here.

// Values are declared once as runtime arrays with the types derived from them, so the MST enumerations
// (trial-model) and the saved-state validator share one source and can't drift.

/** Land air-mass pathway values (user-selected). The circled map numbers are 1 = N/NW, 4 = W. */
export const LAND_PATHWAYS = ["N/NW", "W"] as const;
/** Ocean air-mass pathway values (user-selected). The circled map numbers are 2 = S/SE, 3 = NE. */
export const OCEAN_PATHWAYS = ["S/SE", "NE"] as const;
/** Air-mass humidity values (user-selected, both air masses). */
export const HUMIDITIES = ["Dry", "Humid"] as const;
/** Land air-mass temperature values (user-selected). */
export const LAND_TEMPERATURES = ["Cold", "Warm"] as const;
/** Ocean air-mass temperature values — DERIVED from the ocean pathway (never user-selected). */
export const OCEAN_TEMPERATURES = ["Warm", "Cool"] as const;
/** Weather outcome values, in the approved display order. */
export const OUTCOMES = [
  "strong",
  "moderate",
  "weakCoastal",
  "humidNoStorm",
  "dryFront",
  "fair",
] as const;

export type LandPathway = (typeof LAND_PATHWAYS)[number];
export type OceanPathway = (typeof OCEAN_PATHWAYS)[number];
export type Humidity = (typeof HUMIDITIES)[number];
export type LandTemperature = (typeof LAND_TEMPERATURES)[number];
export type OceanTemperature = (typeof OCEAN_TEMPERATURES)[number];
export type Outcome = (typeof OUTCOMES)[number];

/**
 * A complete air-mass setup — the five user selections that drive the outcome. Ocean temperature is
 * intentionally absent: it is derived from the ocean pathway and does not influence the outcome.
 */
export interface AirMassSetup {
  readonly landPathway: LandPathway;
  readonly landHumidity: Humidity;
  readonly landTemperature: LandTemperature;
  readonly oceanPathway: OceanPathway;
  readonly oceanHumidity: Humidity;
}

/**
 * Derive the ocean air-mass temperature from its pathway: S/SE → Warm, NE → Cool; `null` until a
 * pathway is chosen. Display-only — it never feeds `evaluateOutcome` (hence its absence from
 * `AirMassSetup`).
 */
export function deriveOceanTemperature(pathway: OceanPathway | null): OceanTemperature | null {
  if (pathway === null) return null;
  return pathway === "NE" ? "Cool" : "Warm";
}

/** A classifier row: a complete setup and its approved outcome. */
export interface SetupRow extends AirMassSetup {
  readonly outcome: Outcome;
}

/**
 * The approved "All 32 combinations" tab, verbatim — THE classifier. `evaluateOutcome(setup)` is a
 * lookup into this table, so reclassifying a setup is a one-line data edit here; nothing else changes.
 * Outputs are NOT duplicated here — they live in OUTCOME_VALUES/OUTCOME_METADATA keyed by outcome.
 *
 * The physical logic behind these rows (a documentation + in-test oracle, not code):
 *   landColdDry = landTemperature === "Cold" && landHumidity === "Dry"
 *   oceanHumid  = oceanHumidity === "Humid"
 *   oceanWarm   = oceanPathway === "S/SE"  // S/SE (2) → warm Gulf Stream; NE (3) → cool
 *   landColdDry && oceanHumid && oceanWarm  → landPathway === "N/NW" ? strong : moderate
 *   landColdDry && oceanHumid && !oceanWarm → weakCoastal
 *   landColdDry && !oceanHumid              → dryFront
 *   !landColdDry && oceanHumid && oceanWarm → humidNoStorm
 *   otherwise                               → fair
 *
 * PROVENANCE — transcribed verbatim from the approved Google Sheet "Nor'easter Simulation — Outcomes
 *   Table" (approved 7/20), tab "All 32 combinations" (gid 1610996882):
 *   https://docs.google.com/spreadsheets/d/1SXTg3XJMAgzAXLpBxE1hnqJJ1G-aGLJwnMc51rvTAsQ/edit?gid=1610996882
 *   Read from the live sheet on 2026-07-21. Distribution: strong 1, moderate 1, weakCoastal 2,
 *   humidNoStorm 6, dryFront 4, fair 18 (= 32).
 */
export const SETUP_OUTCOMES: readonly SetupRow[] = [
  // Land N/NW
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "dryFront",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "strong",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "dryFront",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "weakCoastal",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
  // Land W
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "dryFront",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "moderate",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "dryFront",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "weakCoastal",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
    outcome: "humidNoStorm",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Dry",
    outcome: "fair",
  },
  {
    landPathway: "W",
    landHumidity: "Humid",
    landTemperature: "Warm",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
    outcome: "fair",
  },
];

/** The stable signature of a setup — its five selections, order-fixed — used as the lookup key. */
const sig = (s: AirMassSetup) =>
  `${s.landPathway}|${s.landHumidity}|${s.landTemperature}|${s.oceanPathway}|${s.oceanHumidity}`;

const SETUP_INDEX: ReadonlyMap<string, Outcome> = new Map(
  SETUP_OUTCOMES.map((r) => [sig(r), r.outcome]),
);

/**
 * Determine the weather outcome for a completed setup — a lookup into the approved `SETUP_OUTCOMES`
 * table. Throws on an unmapped setup (a data gap); `weather.test.ts` sweeps all 32 setups, so a
 * missing row would fail there rather than reach production.
 */
export function evaluateOutcome(setup: AirMassSetup): Outcome {
  const outcome = SETUP_INDEX.get(sig(setup));
  if (!outcome) throw new Error(`No approved outcome for setup ${sig(setup)}`);
  return outcome;
}
