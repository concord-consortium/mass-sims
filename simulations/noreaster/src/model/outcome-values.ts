// Weather-outcome OUTPUTS: the per-outcome Data-panel values (and non-displayed metadata). Pure data
// (no React, no MST, no side effects). Paired with the classifier in `weather.ts`, which maps a setup
// to an `Outcome`; this file maps an `Outcome` to what the Data panel shows for it.
//
// PROVENANCE — transcribed verbatim from the approved Google Sheet
//   "Nor'easter Simulation — Outcomes Table" (approved 7/20), tab
//   "All 32 combinations" (gid 1610996882):
//   https://docs.google.com/spreadsheets/d/1SXTg3XJMAgzAXLpBxE1hnqJJ1G-aGLJwnMc51rvTAsQ/edit?gid=1610996882
//   Read from the live sheet on 2026-07-21. The exact glyphs are intentional (curly apostrophe ’,
//   en-dash – in the wind ranges, ~ in "~80%", the comma in "Humid, no storm"). Editing an approved
//   value later is a one-line change here — bump the read date above when you do.
//
// This module imports only the `Outcome` TYPE from weather.ts (type-only ⇒ no runtime dependency in
// either direction). Consumers of presentation data — the Data panel, control-bar's banner — import
// from here directly.

import type { Outcome } from "./weather";

/** The 7 fields the Data panel renders (and only those). Readonly: these are shared singletons. */
export interface OutcomeValues {
  readonly label: string; // pill banner + the "Weather outcome" row
  readonly sky: string;
  readonly pressure: string;
  readonly wind: string;
  readonly precipType: string;
  readonly precipAmount: string;
  readonly stormIntensity: string;
}

/**
 * Non-displayed model metadata. Carried by the model (approved data worth preserving) but excluded
 * from the Data panel by design: `coastalFlooding` is explicitly not shown; `commaCloud` drives the
 * later animation story. Kept as the sheet's verbatim strings — a future consumer can introduce a
 * typed shape keyed off `Outcome` when it has real requirements.
 */
export interface OutcomeMetadata {
  readonly coastalFlooding: string;
  readonly commaCloud: string;
}

/** The displayed values per outcome. Exhaustive by construction — a new outcome key forces a new row. */
export const OUTCOME_VALUES: Readonly<Record<Outcome, OutcomeValues>> = {
  strong: {
    label: "Strong nor’easter",
    sky: "Overcast, storm clouds",
    pressure: "Low",
    wind: "From the NE, 45–60 mph",
    precipType: "Rain (snow inland)",
    precipAmount: "Heavy",
    stormIntensity: "Strong",
  },
  moderate: {
    label: "Moderate nor’easter",
    sky: "Overcast, storm clouds",
    pressure: "Low",
    wind: "From the NE, 25–35 mph",
    precipType: "Rain (mix inland)",
    precipAmount: "Moderate",
    stormIntensity: "Moderate",
  },
  weakCoastal: {
    label: "Weak coastal storm",
    sky: "Cloudy, raw",
    pressure: "Slightly low",
    wind: "From the NE, 15–20 mph",
    precipType: "Light rain / wet snow",
    precipAmount: "Light",
    stormIntensity: "Weak",
  },
  humidNoStorm: {
    label: "Humid, no storm",
    sky: "Overcast, hazy",
    pressure: "Near normal",
    wind: "Light, S/SE",
    precipType: "Stray shower",
    precipAmount: "Trace",
    stormIntensity: "None",
  },
  dryFront: {
    label: "Dry front passes",
    sky: "Clearing, breezy",
    pressure: "Rising",
    wind: "Gusty NW shift",
    precipType: "None",
    precipAmount: "None",
    stormIntensity: "None",
  },
  fair: {
    label: "Fair weather",
    sky: "Sunny and fair",
    pressure: "High",
    wind: "Calm, variable",
    precipType: "None",
    precipAmount: "None",
    stormIntensity: "None",
  },
};

/** The non-displayed metadata per outcome. Exhaustive by construction. */
export const OUTCOME_METADATA: Readonly<Record<Outcome, OutcomeMetadata>> = {
  strong: { coastalFlooding: "Major", commaCloud: "Full spiral, 100%" },
  moderate: { coastalFlooding: "Moderate", commaCloud: "~80%" },
  weakCoastal: { coastalFlooding: "Minor splashover", commaCloud: "Small" },
  humidNoStorm: { coastalFlooding: "None", commaCloud: "Haze, no spiral" },
  dryFront: { coastalFlooding: "None", commaCloud: "Hidden" },
  fair: { coastalFlooding: "None", commaCloud: "Hidden" },
};

// Derived single source for the banner (control-bar's run-complete announcement reads it directly).
// Each banner IS the outcome's label — one label source, no second copy to drift.
export const OUTCOME_BANNER: Readonly<Record<Outcome, string>> = Object.fromEntries(
  (Object.entries(OUTCOME_VALUES) as [Outcome, OutcomeValues][]).map(([k, v]) => [k, v.label]),
) as Record<Outcome, string>;
