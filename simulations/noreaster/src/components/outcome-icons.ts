import type { Outcome } from "../model/weather";
import type { IconKey } from "./icons/weather-icons";

// Presentation-layer data: which weather icon each attribute shows for each outcome — parallel to the
// model's OUTCOME_VALUES (the displayed text) but keyed to the icon registry. Type-only imports, so no
// runtime coupling to the icon SVGs.

/**
 * The icon each Data-panel attribute renders. Each field's type is the valid key union for its icon
 * family, so a wrong key is a compile error. Note the one field↔family divergence: the `stormIntensity`
 * row reads the `storm` icon family.
 */
export interface WeatherIconSet {
  sky: IconKey<"sky">;
  pressure: IconKey<"pressure">;
  wind: IconKey<"wind">;
  precipType: IconKey<"precipType">;
  precipAmount: IconKey<"precipAmount">;
  stormIntensity: IconKey<"storm">;
}

/**
 * Outcome → its six weather icons. Exhaustive over `Outcome` by construction — a new outcome key
 * forces a new row.
 */
export const OUTCOME_ICONS: Record<Outcome, WeatherIconSet> = {
  strong: {
    sky: "overcast",
    pressure: "low",
    wind: "neHigh",
    precipType: "rain",
    precipAmount: "heavy",
    stormIntensity: "strong",
  },
  moderate: {
    sky: "overcast",
    pressure: "low",
    wind: "neMedium",
    precipType: "rain",
    precipAmount: "moderate",
    stormIntensity: "moderate",
  },
  weakCoastal: {
    sky: "cloudy",
    pressure: "slightlyLow",
    wind: "neLow",
    precipType: "lightRain",
    precipAmount: "light",
    stormIntensity: "weak",
  },
  humidNoStorm: {
    sky: "overcastHazy",
    pressure: "nearNormal",
    wind: "sseLight",
    precipType: "strayShower",
    precipAmount: "trace",
    stormIntensity: "none",
  },
  dryFront: {
    sky: "clearingBreezy",
    pressure: "rising",
    wind: "nwGusty",
    precipType: "none",
    precipAmount: "none",
    stormIntensity: "none",
  },
  fair: {
    sky: "sunny",
    pressure: "high",
    wind: "none",
    precipType: "none",
    precipAmount: "none",
    stormIntensity: "none",
  },
};
