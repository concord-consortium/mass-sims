import { type TrialLetter, toVersionedSavedState } from "@concord-consortium/mass-sims-shared";
import { COLLAPSE_TRIAL_LETTERS, type CollapseTrialLetter } from "../trial-conditions";
import type { RootStoreSnapshotOut } from "./root-store";
import { emptyTrialSnapshot, makeSeed, type TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 1;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isFiniteNumberArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isFiniteNumber);
}

/** A `SimInput` with usable run parameters — positive counts plus a seed string. */
function isSimInput(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.walkerCount) &&
    value.walkerCount > 0 &&
    isFiniteNumber(value.stepSize) &&
    value.stepSize > 0 &&
    isFiniteNumber(value.framesPerTrial) &&
    value.framesPerTrial > 0 &&
    typeof value.seed === "string"
  );
}
/** A `SimOutput` — the recorded avg / σ plus the sampled series. */
function isSimOutput(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.avgDistance) &&
    isFiniteNumber(value.stdDevDistance) &&
    isFiniteNumberArray(value.avgDistanceSeries)
  );
}
/** A `SimTransient` final-frame snapshot — frame, walker positions, sampled series. */
function isSimTransient(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.frame) &&
    Array.isArray(value.walkers) &&
    value.walkers.every((w) => isObject(w) && isFiniteNumber(w.x) && isFiniteNumber(w.y)) &&
    isFiniteNumberArray(value.avgDistanceSeries)
  );
}

/**
 * Whether a persisted trial value can hydrate into a *runnable* `TrialModel`. `input` / `output` /
 * `finalTransient` are stored as `types.frozen`, so MST does NOT validate their inner shape — an
 * `{ input: {} }` would otherwise hydrate a broken trial (zero walkers, a run that never completes)
 * rather than being replaced by an empty trial. So the field shapes are checked explicitly here.
 * `input` is required; `output` / `finalTransient` are nullable but must match their shape when set.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { input, output, finalTransient } = value;
  if (!isSimInput(input)) return false;
  if (output != null && !isSimOutput(output)) return false;
  if (finalTransient != null && !isSimTransient(finalTransient)) return false;
  return true;
}

/**
 * The shape persisted to / restored from Activity Player's `interactiveState`: the four-trial map
 * (keyed by letter A–D) plus the active trial letter, tagged with a `version` for forward migration.
 * Per-frame transient state is never persisted.
 */
export interface SavedState {
  version: typeof SAVED_STATE_VERSION;
  trials: Record<CollapseTrialLetter, TrialState>;
  selectedTrialLetter: TrialLetter;
}

/** Project the persisted slice out of a full root-store snapshot, via the shared envelope helper. */
export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return toVersionedSavedState(SAVED_STATE_VERSION, snap) as SavedState;
}

/**
 * Normalize a restored `interactiveState` into a `SavedState` with exactly the four trials A–D, in
 * that order, or `null` when it's unrecognized (a wrong `version`, or a non-object payload or
 * `trials`; the caller then keeps its fresh seeded store). It *selects* rather than rejects: each
 * of A–D keeps its saved trial if that trial is hydratable and is otherwise replaced by an empty
 * one (one bad trial doesn't discard the other three), and keys outside A–D are ignored. The result
 * is built in A–D order because the object's key order is the order `applySnapshot` puts into the
 * trials map, which is the order the Trials panel renders. A `selectedTrialLetter` outside A–D
 * becomes "A".
 *
 * `rng` seeds the replacement trials (App passes the same `Math.random` it gives `createRootStore`;
 * tests pass a seeded PRNG). The `version` field is the forward-migration hook: today only version 1
 * exists, so future shape changes would branch on `version` here. (This sim has never shipped, so
 * there is no pre-versioned saved state to migrate from.)
 */
export function migrateSavedState(raw: unknown, rng: () => number): SavedState | null {
  if (!isObject(raw)) return null;
  const { version, trials, selectedTrialLetter } = raw;
  if (version !== SAVED_STATE_VERSION) return null;
  if (!isObject(trials)) return null;
  const normalized = {} as Record<CollapseTrialLetter, TrialState>;
  for (const letter of COLLAPSE_TRIAL_LETTERS) {
    const trial = trials[letter];
    normalized[letter] = isHydratableTrial(trial)
      ? (trial as TrialState)
      : emptyTrialSnapshot(makeSeed(rng));
  }
  const selected = COLLAPSE_TRIAL_LETTERS.find((letter) => letter === selectedTrialLetter) ?? "A";
  return {
    version: SAVED_STATE_VERSION,
    trials: normalized,
    selectedTrialLetter: selected,
  };
}
