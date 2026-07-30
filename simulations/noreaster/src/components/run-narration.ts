import { OUTCOME_VALUES } from "../model/outcome-values";
import { type AirMassSetup, deriveOceanTemperature, type Outcome } from "../model/weather";

/**
 * Run-animation narration — the staged `aria-live` messages. Pure text so it's unit-tested; the runner
 * (`use-storm-run`) speaks these through the shared `<Announcer>` across the run: the start line at
 * begin, the staged lines as the runner's clock crosses their times, and the full outcome readout at
 * finalize. Under reduced motion the runner speaks only the start + the readout.
 */

/** The run-start "…converging" line, describing the two air masses. */
export function startNarration(setup: AirMassSetup, replay: boolean): string {
  const oceanTemp = deriveOceanTemperature(setup.oceanPathway) ?? "";
  const land = `${setup.landTemperature.toLowerCase()} ${setup.landHumidity.toLowerCase()}`;
  const ocean = `${oceanTemp.toLowerCase()} ${setup.oceanHumidity.toLowerCase()}`;
  return (
    `${replay ? "Replaying" : "Running"} simulation, ${land} air mass from the ${setup.landPathway} ` +
    `and ${ocean} air mass from the ${setup.oceanPathway} converging`
  );
}

/** Staged mid-run lines per outcome, timed in ms from run start. */
export const STAGED_NARRATION: Record<Outcome, readonly { atMs: number; text: string }[]> = {
  strong: [
    { atMs: 1500, text: "Nor’easter forming" },
    {
      atMs: 5000,
      text: "Nor’easter growing into a strong nor’easter, moving northeast along the coast, offshore",
    },
  ],
  moderate: [
    { atMs: 1500, text: "Nor’easter forming" },
    {
      atMs: 4000,
      text: "Nor’easter growing into a moderate nor’easter, moving northeast along the coast, offshore",
    },
  ],
  weakCoastal: [
    { atMs: 1500, text: "Clouds building, weak coastal storm developing" },
    { atMs: 3000, text: "Damp, light/wintry conditions and light precipitation along the coast" },
  ],
  humidNoStorm: [
    { atMs: 1500, text: "Warm moist air drifting onshore, overcast and hazy, scattered rain" },
  ],
  windy: [{ atMs: 1500, text: "Clear, breezy, no nor’easter or storm forms" }],
  fair: [{ atMs: 1500, text: "Fair weather, no nor’easter or storm forms" }],
};

/** The full outcome readout spoken at finalize. */
export function finalNarration(outcome: Outcome): string {
  const v = OUTCOME_VALUES[outcome];
  return (
    `Weather Outcome: ${v.label}. Sky: ${v.sky}. Wind: ${v.wind}. ` +
    `Precipitation Type: ${v.precipType}. Precipitation Amount: ${v.precipAmount}. ` +
    `Storm Intensity: ${v.stormIntensity}.`
  );
}
