import type {
  LandPathway,
  LandTemperature,
  OceanPathway,
  OceanTemperature,
} from "../model/weather";

/**
 * A semantic tint state, applied to an element as a `data-tint` attribute; the stylesheet maps each
 * state to a theme color (`neutral → $arrow-neutral`/`$icon-color`, `selected-neutral → $heading`,
 * `warm → $temp-warm`, `cool → $temp-cool`). Keeping the color out of TypeScript avoids duplicating
 * the SCSS palette. Shared by the air-mass row icons and the pathway arrows.
 */
export type Tint = "neutral" | "selected-neutral" | "warm" | "cool";

/**
 * Map an air-mass temperature to its tint. "Warm" is the warm (red) tint; land "Cold" and ocean
 * "Cool" are both the cool (blue) tint; no temperature (`null`) is neutral.
 */
export function tempTint(temperature: LandTemperature | OceanTemperature | null): Tint {
  if (temperature === "Warm") return "warm";
  if (temperature === "Cold" || temperature === "Cool") return "cool";
  return "neutral";
}

/** A pathway arrow's computed appearance: its tint and whether it is dimmed. */
export interface ArrowTint {
  tint: Tint;
  dimmed: boolean;
}

/**
 * Compute one pathway arrow's tint + dim state from the current selections. Arrows are
 * 1 = N/NW, 4 = W (land) and 2 = S/SE, 3 = NE (ocean).
 *
 *  - The arrow matching the selected LAND pathway tints by the land temperature — or `selected-neutral`
 *    until a temperature is chosen. The arrow matching the selected OCEAN pathway tints by the derived
 *    ocean temperature (S/SE → warm, NE → cool) — never `selected-neutral`, since ocean temp is derived.
 *  - Once a pathway is chosen for an air mass, that air mass's OTHER arrow dims.
 *  - Everything else stays neutral and undimmed.
 *
 * Run-time arrow convergence/hiding is out of scope here — this is selection feedback only.
 */
export function arrowTint(
  arrow: number,
  landPathway: LandPathway | null,
  landTemperature: LandTemperature | null,
  oceanPathway: OceanPathway | null,
): ArrowTint {
  if (arrow === 1 || arrow === 4) {
    const landNum = landPathway === null ? null : landPathway === "N/NW" ? 1 : 4;
    if (landNum === arrow) {
      return {
        tint: landTemperature === null ? "selected-neutral" : tempTint(landTemperature),
        dimmed: false,
      };
    }
    return { tint: "neutral", dimmed: landNum !== null };
  }
  const oceanNum = oceanPathway === null ? null : oceanPathway === "S/SE" ? 2 : 3;
  if (oceanNum === arrow) {
    return { tint: tempTint(oceanPathway === "S/SE" ? "Warm" : "Cool"), dimmed: false };
  }
  return { tint: "neutral", dimmed: oceanNum !== null };
}
