// Weather-outcome OUTPUTS: the per-outcome Data-panel values (and non-displayed metadata). Pure data
// (no React, no MST, no side effects). Paired with the classifier in `weather.ts`, which maps a setup
// to an `Outcome`; this file maps an `Outcome` to what the Data panel shows for it.
//
// PROVENANCE — transcribed verbatim from the approved Google Sheet
//   "Nor'easter Simulation — Outcomes Table", tab "Data outputs per outcome":
//   https://docs.google.com/spreadsheets/d/1SXTg3XJMAgzAXLpBxE1hnqJJ1G-aGLJwnMc51rvTAsQ/
//   Read from the live sheet on 2026-07-27. The exact glyphs are intentional (curly apostrophe ’,
//   en-dash – in the wind ranges, ~ in "~80%", the comma in "Windy, no storm"/"Humid, no storm").
//   Editing an approved value later is a one-line change here — bump the read date above when you do.
//
// This module imports only the `Outcome` TYPE from weather.ts (type-only ⇒ no runtime dependency in
// either direction). Consumers of presentation data — the Data panel, control-bar's banner — import
// from here directly.

import type { Outcome } from "./weather";

/** The 6 fields the Data panel renders for an outcome (the pill banner + the 5 attribute rows).
 *  Readonly: these are shared singletons. */
export interface OutcomeValues {
  readonly label: string; // the outcome pill/banner; also OUTCOME_BANNER (run-complete announcement)
  readonly sky: string;
  readonly wind: string;
  readonly precipType: string;
  readonly precipAmount: string;
  readonly stormIntensity: string;
}

/**
 * Non-displayed model metadata. Carried by the model (approved data worth preserving) but excluded
 * from the Data panel by design: `coastalFlooding` is explicitly not shown; `commaCloud` drives the
 * later animation story; `pressure` is retained here (not shown) in case it returns. Kept as the
 * sheet's verbatim strings — a future consumer can introduce a typed shape keyed off `Outcome` when
 * it has real requirements.
 */
export interface OutcomeMetadata {
  readonly coastalFlooding: string;
  readonly commaCloud: string;
  readonly pressure: string;
}

/** The displayed values per outcome. Exhaustive by construction — a new outcome key forces a new row. */
export const OUTCOME_VALUES: Readonly<Record<Outcome, OutcomeValues>> = {
  strong: {
    label: "Strong nor’easter",
    sky: "Overcast, storm clouds",
    wind: "From the NE, 45–60 mph",
    precipType: "Rain (snow inland)",
    precipAmount: "Heavy",
    stormIntensity: "Strong",
  },
  moderate: {
    label: "Moderate nor’easter",
    sky: "Overcast, storm clouds",
    wind: "From the NE, 25–35 mph",
    precipType: "Rain (mix inland)",
    precipAmount: "Moderate",
    stormIntensity: "Moderate",
  },
  weakCoastal: {
    label: "Weak coastal storm",
    sky: "Cloudy",
    wind: "From the NE, 15–20 mph",
    precipType: "Light rain / wet snow",
    precipAmount: "Light",
    stormIntensity: "Weak",
  },
  humidNoStorm: {
    label: "Humid, no storm",
    sky: "Overcast, hazy",
    wind: "From the S/SE, 5–15 mph",
    precipType: "Scattered rain",
    precipAmount: "Trace",
    stormIntensity: "None",
  },
  windy: {
    label: "Windy, no storm",
    sky: "Clear, breezy",
    wind: "From the NW, 15–25 mph",
    precipType: "None",
    precipAmount: "None",
    stormIntensity: "None",
  },
  fair: {
    label: "Fair weather",
    sky: "Sunny",
    wind: "Variable, 0–10 mph",
    precipType: "None",
    precipAmount: "None",
    stormIntensity: "None",
  },
};

/** The non-displayed metadata per outcome. Exhaustive by construction. */
export const OUTCOME_METADATA: Readonly<Record<Outcome, OutcomeMetadata>> = {
  strong: { coastalFlooding: "Major", commaCloud: "Full spiral, 100%", pressure: "Low" },
  moderate: { coastalFlooding: "Moderate", commaCloud: "~80%", pressure: "Low" },
  weakCoastal: {
    coastalFlooding: "Minor splashover",
    commaCloud: "Small",
    pressure: "Slightly low",
  },
  humidNoStorm: { coastalFlooding: "None", commaCloud: "Haze, no spiral", pressure: "Near normal" },
  windy: { coastalFlooding: "None", commaCloud: "Hidden", pressure: "Rising" },
  fair: { coastalFlooding: "None", commaCloud: "Hidden", pressure: "High" },
};

// Derived single source for the banner (control-bar's run-complete announcement reads it directly).
// Each banner IS the outcome's label — one label source, no second copy to drift.
export const OUTCOME_BANNER: Readonly<Record<Outcome, string>> = Object.fromEntries(
  (Object.entries(OUTCOME_VALUES) as [Outcome, OutcomeValues][]).map(([k, v]) => [k, v.label]),
) as Record<Outcome, string>;
