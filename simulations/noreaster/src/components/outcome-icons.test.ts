import { describe, expect, it } from "vitest";
import { OUTCOMES } from "../model/weather";
import { ICONS } from "./icons/weather-icons";
import { OUTCOME_ICONS, type WeatherIconSet } from "./outcome-icons";

// Each WeatherIconSet field's icon-registry family (identity except stormIntensity → storm) — lets the
// per-outcome check below resolve each icon key against the right ICONS family.
const FIELD_FAMILY: Record<keyof WeatherIconSet, keyof typeof ICONS> = {
  sky: "sky",
  pressure: "pressure",
  wind: "wind",
  precipType: "precipType",
  precipAmount: "precipAmount",
  stormIntensity: "storm",
};

describe("weather icon registry", () => {
  it("every registry icon resolves to a defined component", () => {
    for (const family of Object.keys(ICONS) as (keyof typeof ICONS)[]) {
      const entries = ICONS[family] as Record<string, unknown>;
      for (const key of Object.keys(entries)) {
        expect(entries[key], `ICONS.${family}.${key}`).toBeTruthy();
      }
    }
  });
});

describe("OUTCOME_ICONS", () => {
  it("has an entry for every outcome", () => {
    for (const outcome of OUTCOMES) {
      expect(OUTCOME_ICONS[outcome], `OUTCOME_ICONS.${outcome}`).toBeDefined();
    }
  });

  it("every per-outcome icon key resolves to a component in the registry", () => {
    const fields = Object.keys(FIELD_FAMILY) as (keyof WeatherIconSet)[];
    for (const outcome of OUTCOMES) {
      const iconSet = OUTCOME_ICONS[outcome];
      for (const field of fields) {
        const family = FIELD_FAMILY[field];
        const key = iconSet[field] as string;
        const registryFamily = ICONS[family] as Record<string, unknown>;
        expect(registryFamily[key], `${outcome}.${field} → ${family}.${key}`).toBeTruthy();
      }
    }
  });
});
