import type { AirMassSetup, Outcome } from "../model/weather";
import type { TrialModelInstance } from "./trial-model";

/**
 * One complete air-mass setup per outcome, each drawn from the weather model's `SETUP_OUTCOMES` so the
 * trial evaluates to that outcome (the specs assert it).
 */
export const SETUPS: Record<Outcome, AirMassSetup> = {
  strong: {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
  },
  moderate: {
    landPathway: "W",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
  },
  weakCoastal: {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "NE",
    oceanHumidity: "Humid",
  },
  humidNoStorm: {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Humid",
  },
  dryFront: {
    landPathway: "N/NW",
    landHumidity: "Dry",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
  },
  fair: {
    landPathway: "N/NW",
    landHumidity: "Humid",
    landTemperature: "Cold",
    oceanPathway: "S/SE",
    oceanHumidity: "Dry",
  },
};

/** The setup that yields a strong nor'easter — a named export several specs reference directly. */
export const STRONG_SETUP: AirMassSetup = SETUPS.strong;

/** Apply a setup to a trial via its setters (completes the setup, does not run). */
export function configure(trial: TrialModelInstance, setup: AirMassSetup): void {
  trial.setLandPathway(setup.landPathway);
  trial.setLandHumidity(setup.landHumidity);
  trial.setLandTemperature(setup.landTemperature);
  trial.setOceanPathway(setup.oceanPathway);
  trial.setOceanHumidity(setup.oceanHumidity);
}

/** Configure + run a trial so it carries a recorded outcome. */
export function runSetup(trial: TrialModelInstance, setup: AirMassSetup): void {
  configure(trial, setup);
  trial.run();
}

/** Apply {@link STRONG_SETUP} to a trial (completes the setup, does not run). */
export function configureStrong(trial: TrialModelInstance): void {
  configure(trial, STRONG_SETUP);
}

/** Configure + run a trial so it carries a recorded (strong) outcome. */
export function runStrong(trial: TrialModelInstance): void {
  runSetup(trial, STRONG_SETUP);
}
