import { type Instance, type SnapshotOut, types } from "mobx-state-tree";
import {
  type AirMassSetup,
  deriveOceanTemperature,
  evaluateOutcome,
  HUMIDITIES,
  type Humidity,
  LAND_PATHWAYS,
  LAND_TEMPERATURES,
  type LandPathway,
  type LandTemperature,
  OCEAN_PATHWAYS,
  type OceanPathway,
  type OceanTemperature,
  OUTCOMES,
  type Outcome,
} from "../model/weather";

/**
 * One trial's state: the five user-selected air-mass fields (the trial INPUT) plus the recorded
 * `outcome` (the trial OUTPUT — `null` until run). A trial's identity is its letter (the key in the
 * RootStore's `trials` map), so there is no `id`/`seed` — the outcome is fully determined by the
 * selections (no randomness).
 *
 * Each selection is a `types.enumeration`, so MST validates on assignment and on hydrate — an
 * out-of-range value throws. The saved-state validator gates enum membership up front so
 * `applySnapshot` never throws mid-hydrate (see `saved-state.ts`).
 */
export const TrialModel = types
  .model("Trial", {
    landPathway: types.maybeNull(types.enumeration<LandPathway>("LandPathway", [...LAND_PATHWAYS])),
    landHumidity: types.maybeNull(types.enumeration<Humidity>("LandHumidity", [...HUMIDITIES])),
    landTemperature: types.maybeNull(
      types.enumeration<LandTemperature>("LandTemperature", [...LAND_TEMPERATURES]),
    ),
    oceanPathway: types.maybeNull(
      types.enumeration<OceanPathway>("OceanPathway", [...OCEAN_PATHWAYS]),
    ),
    oceanHumidity: types.maybeNull(types.enumeration<Humidity>("OceanHumidity", [...HUMIDITIES])),
    outcome: types.maybeNull(types.enumeration<Outcome>("Outcome", [...OUTCOMES])),
  })
  .views((self) => ({
    /** All five air-mass selections made — the Run-enable gate. */
    get setupComplete(): boolean {
      return !!(
        self.landPathway &&
        self.landHumidity &&
        self.landTemperature &&
        self.oceanPathway &&
        self.oceanHumidity
      );
    },
    /** The trial has been run: selectors lock to read-only pills and Run reads "Replay". */
    get hasRun(): boolean {
      return self.outcome !== null;
    },
    /** Post-run lock. Derived from `outcome` so it can't drift from "has a recorded result". */
    get locked(): boolean {
      return self.outcome !== null;
    },
    /** Reset is enabled once anything is set (any selection, or a recorded outcome). */
    get canReset(): boolean {
      return !!(
        self.landPathway ||
        self.landHumidity ||
        self.landTemperature ||
        self.oceanPathway ||
        self.oceanHumidity ||
        self.outcome
      );
    },
    /** The complete, validated setup — defined only once `setupComplete`. Feeds the outcomes model. */
    get setup(): AirMassSetup | null {
      return this.setupComplete
        ? {
            landPathway: self.landPathway as LandPathway,
            landHumidity: self.landHumidity as Humidity,
            landTemperature: self.landTemperature as LandTemperature,
            oceanPathway: self.oceanPathway as OceanPathway,
            oceanHumidity: self.oceanHumidity as Humidity,
          }
        : null;
    },
    /**
     * Ocean air-mass temperature — DERIVED, not user-selected (non-editable pill). `null` (shown as
     * the `–` placeholder) until an ocean pathway is chosen. The pill, the ocean air-mass icon tint,
     * and the ocean-arrow tint all read this (`null` ⇒ neutral). It is display-only: it never gates
     * Run and never feeds the outcome. The pathway → temperature mapping lives in weather.ts.
     */
    get oceanTemperature(): OceanTemperature | null {
      return deriveOceanTemperature(self.oceanPathway);
    },
  }))
  .actions((self) => ({
    // Selection setters no-op once locked — post-run selectors are read-only pills. One per field.
    setLandPathway(value: LandPathway) {
      if (!self.locked) self.landPathway = value;
    },
    setLandHumidity(value: Humidity) {
      if (!self.locked) self.landHumidity = value;
    },
    setLandTemperature(value: LandTemperature) {
      if (!self.locked) self.landTemperature = value;
    },
    setOceanPathway(value: OceanPathway) {
      if (!self.locked) self.oceanPathway = value;
    },
    setOceanHumidity(value: Humidity) {
      if (!self.locked) self.oceanHumidity = value;
    },
    /**
     * Run (and Replay): determine and record the outcome from the current setup. No-op until the
     * setup is complete. Deterministic, so Replay recomputes the same outcome. `self.setup` is
     * available here because the views above are composed before this actions block.
     */
    run() {
      const setup = self.setup;
      if (!setup) return;
      self.outcome = evaluateOutcome(setup);
    },
    /** Reset to the default, unconfigured trial: clear the five selections and the recorded outcome. */
    reset() {
      self.landPathway = null;
      self.landHumidity = null;
      self.landTemperature = null;
      self.oceanPathway = null;
      self.oceanHumidity = null;
      self.outcome = null;
    },
  }));

export type TrialModelInstance = Instance<typeof TrialModel>;

/** The per-trial wire format, derived from `TrialModel` so it can't drift from the store. */
export type TrialState = SnapshotOut<typeof TrialModel>;

/**
 * Factory (not a shared constant): each call returns a fresh snapshot so resets and separate trials
 * never share a mutable object. A trial starts fully unconfigured (every field `null`).
 */
export function emptyTrialSnapshot() {
  return {
    landPathway: null,
    landHumidity: null,
    landTemperature: null,
    oceanPathway: null,
    oceanHumidity: null,
    outcome: null,
  };
}
