import type { Outcome } from "../model/weather";

/**
 * Per-outcome descriptor for the Data-panel header weather scene — pure presentation data, parallel to
 * `OUTCOME_VALUES` / `OUTCOME_ICONS`. The backdrop is CSS (chosen by a `data-scene` attribute); this only
 * carries what the canvas hook needs — which particle system to run, plus `dark` for the heading treatment.
 */

/**
 * Which particle system the canvas hook runs.
 * - `snow` — the three storm modes' precipitation (rain streaks / weak mix), selected by `stormMode`.
 * - `sunRays` — flickering gold sun rays.
 * - `windyBreezy` — the gold ray engine (shared with `sunRays`) plus a white wind-curl overlay.
 * - `haze` — drifting warm wisps + an intermittent light-rain shower.
 * - `none` — no particles (`outcome === null`).
 */
export type ScenePlayer = "snow" | "sunRays" | "windyBreezy" | "haze" | "none";

/**
 * The three snow modes are DISTINCT precipitation systems, NOT one effect scaled by a number: `stormMode`
 * selects particle type / angles / speeds / base spawn count; `snowIntensity` scales GUSTS ONLY.
 */
export type StormMode = "strong" | "moderate" | "weak";

/**
 * Discriminated on `player`: only snow scenes carry `stormMode` / `snowIntensity`, so an invalid descriptor
 * is a compile error and consumers read those fields with no fallback. `dark` drives `data-scene-theme`.
 */
export type SceneSpec =
  | {
      player: "snow";
      stormMode: StormMode;
      /** Gust timing/count/force scalar (1 / 0.68 / 0.3), NOT a spawn-rate or size multiplier. */
      snowIntensity: number;
      /** Storm-gray scenes are always dark. */
      dark: true;
    }
  | {
      player: "sunRays" | "windyBreezy" | "haze" | "none";
      dark: boolean;
    };

/**
 * Exhaustive scene table, one entry per `Outcome`. `satisfies` checks completeness (a missing outcome is a
 * compile error) while preserving each entry's precise variant, so `SCENES.strong.stormMode` stays typed.
 */
export const SCENES = {
  strong: { player: "snow", stormMode: "strong", snowIntensity: 1, dark: true },
  moderate: { player: "snow", stormMode: "moderate", snowIntensity: 0.68, dark: true },
  weakCoastal: { player: "snow", stormMode: "weak", snowIntensity: 0.3, dark: true },
  humidNoStorm: { player: "haze", dark: true },
  windy: { player: "windyBreezy", dark: false }, // warm backdrop + gold rays + wind-curls, like fair
  fair: { player: "sunRays", dark: false }, // warm/light backdrop
} satisfies Record<Outcome, SceneSpec>;

/** The scene for `outcome === null` — no backdrop, no particles (`data-scene="default"`). */
export const NO_SCENE: SceneSpec = { player: "none", dark: false };
