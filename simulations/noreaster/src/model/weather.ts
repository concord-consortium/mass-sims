// Weather-outcome model: pure (no React, no MST, no side effects). Maps a completed air-mass setup to
// a weather outcome. STAND-IN for the MAS-39 "weather outcomes model" story — ships the current v1.13
// 3-outcome logic so the panel works today. The stable seam is the `evaluateOutcome(setup)` API (and
// `OUTCOME_BANNER`); MAS-39 will widen it to 6 outcomes and carry the Data-panel attribute rows. If it
// lands first, delete this file and import from its module — the `AirMassSetup`/`Outcome` contract matches.

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
/** Weather outcome values. v1.13 stand-in has three; MAS-39 widens this to six. */
export const OUTCOMES = ["strong", "moderate", "fair"] as const;

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
  landPathway: LandPathway;
  landHumidity: Humidity;
  landTemperature: LandTemperature;
  oceanPathway: OceanPathway;
  oceanHumidity: Humidity;
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

/**
 * Determine the weather outcome for a completed setup (v1.13). A nor'easter forms only from a
 * Cold + Dry land air mass meeting a Humid ocean air mass on the S/SE pathway: an N/NW land pathway
 * makes it strong, a W land pathway makes it moderate. Every other combination is fair weather — so
 * all 32 possible setups resolve to a defined outcome.
 */
export function evaluateOutcome(setup: AirMassSetup): Outcome {
  const { landPathway, landHumidity, landTemperature, oceanPathway, oceanHumidity } = setup;
  if (
    landTemperature === "Cold" &&
    landHumidity === "Dry" &&
    oceanPathway === "S/SE" &&
    oceanHumidity === "Humid"
  ) {
    if (landPathway === "N/NW") return "strong";
    if (landPathway === "W") return "moderate";
  }
  return "fair";
}

/** Human-readable banner for each outcome (curly apostrophe, matching the design copy). */
export const OUTCOME_BANNER: Record<Outcome, string> = {
  strong: "Strong nor’easter",
  moderate: "Moderate nor’easter",
  fair: "Fair weather",
};
