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

/** A `SimInput` with positive counts and a seed string. */
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
function isSimOutput(value: unknown): boolean {
  return (
    isObject(value) &&
    isFiniteNumber(value.avgDistance) &&
    isFiniteNumber(value.stdDevDistance) &&
    isFiniteNumberArray(value.avgDistanceSeries)
  );
}
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
 * Whether a saved trial can hydrate into a runnable `TrialModel`. Its fields are `types.frozen`, so
 * MST doesn't check their shape; without this, `{ input: {} }` would hydrate a trial that never
 * completes. `input` is required; `output` and `finalTransient` may be null.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { input, output, finalTransient } = value;
  if (!isSimInput(input)) return false;
  if (output != null && !isSimOutput(output)) return false;
  if (finalTransient != null && !isSimTransient(finalTransient)) return false;
  return true;
}

/** The shape saved to and restored from Activity Player's `interactiveState`. */
export interface SavedState {
  version: typeof SAVED_STATE_VERSION;
  trials: Record<CollapseTrialLetter, TrialState>;
  selectedTrialLetter: TrialLetter;
}

/** The saved-state slice of a root-store snapshot. */
export function toSavedState(snap: RootStoreSnapshotOut): SavedState {
  return toVersionedSavedState(SAVED_STATE_VERSION, snap) as SavedState;
}

/**
 * Normalizes a restored `interactiveState` to exactly the four trials A–D, or returns `null` for a
 * wrong `version` or a non-object payload or `trials`. Each of A–D keeps its saved trial if it can
 * hydrate and is otherwise replaced by an empty one, so one bad trial doesn't discard the others.
 * Keys outside A–D are ignored, and a selected letter outside A–D becomes "A".
 *
 * The result is built in A–D order on purpose: `applySnapshot` keeps the key order, and that is the
 * order the Trials panel renders. `rng` seeds the replacement trials. A future shape change would
 * branch on `version` here.
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
