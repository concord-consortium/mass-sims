import type { AirMassSetup } from "../model/weather";
import type { TrialModelInstance } from "./trial-model";

/**
 * The one setup that yields a strong nor'easter: N/NW + Cold + Dry land meeting a S/SE + Humid ocean.
 * Kept in one place so the specs that depend on this setup → outcome mapping update in lockstep when
 * MAS-39 revises the weather model.
 */
export const STRONG_SETUP: AirMassSetup = {
  landPathway: "N/NW",
  landHumidity: "Dry",
  landTemperature: "Cold",
  oceanPathway: "S/SE",
  oceanHumidity: "Humid",
};

/** Apply {@link STRONG_SETUP} to a trial via its setters (completes the setup, does not run). */
export function configureStrong(trial: TrialModelInstance): void {
  trial.setLandPathway(STRONG_SETUP.landPathway);
  trial.setLandHumidity(STRONG_SETUP.landHumidity);
  trial.setLandTemperature(STRONG_SETUP.landTemperature);
  trial.setOceanPathway(STRONG_SETUP.oceanPathway);
  trial.setOceanHumidity(STRONG_SETUP.oceanHumidity);
}

/** Configure + run a trial so it carries a recorded (strong) outcome. */
export function runStrong(trial: TrialModelInstance): void {
  configureStrong(trial);
  trial.run();
}
