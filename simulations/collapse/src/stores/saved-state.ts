import { type TrialLetter, toVersionedSavedState } from "@concord-consortium/mass-sims-shared";
import { TIMELINE_VALUES } from "../model/timeline";
import type { Sample } from "../model/types";
import { COLLAPSE_TRIAL_LETTERS, type CollapseTrialLetter } from "../trial-conditions";
import type { RootStoreSnapshotOut } from "./root-store";
import { emptyTrialSnapshot, type TrialState } from "./trial-model";

export const SAVED_STATE_VERSION = 2;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A `Sample` with finite numbers and a year the timeline can land on. */
function isSample(value: unknown): value is Sample {
  return (
    isObject(value) &&
    isFiniteNumber(value.id) &&
    isFiniteNumber(value.years) &&
    TIMELINE_VALUES.includes(value.years) &&
    isFiniteNumber(value.rate) &&
    isFiniteNumber(value.roof)
  );
}

/**
 * Whether a saved trial can hydrate into a `TrialModel`. Samples are `types.frozen`, so MST doesn't
 * check their shape. The ids must be unique, and `nextSampleId` must be above every id, or a new
 * sample could take an id a restored one already has.
 */
function isHydratableTrial(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { samples, nextSampleId } = value;
  if (!Array.isArray(samples) || !samples.every(isSample)) return false;
  if (!isFiniteNumber(nextSampleId)) return false;
  const ids = samples.map((s) => s.id);
  if (new Set(ids).size !== ids.length) return false;
  return ids.every((id) => id < nextSampleId);
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
 * order the Trials panel renders. A future shape change would branch on `version` here.
 *
 * Version 1 (the Starter's random-walk placeholder) is dropped, not migrated: no Collapse activity
 * has shown it to a student.
 */
export function migrateSavedState(raw: unknown): SavedState | null {
  if (!isObject(raw)) return null;
  const { version, trials, selectedTrialLetter } = raw;
  if (version !== SAVED_STATE_VERSION) return null;
  if (!isObject(trials)) return null;
  const normalized = {} as Record<CollapseTrialLetter, TrialState>;
  for (const letter of COLLAPSE_TRIAL_LETTERS) {
    const trial = trials[letter];
    normalized[letter] = isHydratableTrial(trial) ? (trial as TrialState) : emptyTrialSnapshot();
  }
  const selected = COLLAPSE_TRIAL_LETTERS.find((letter) => letter === selectedTrialLetter) ?? "A";
  return {
    version: SAVED_STATE_VERSION,
    trials: normalized,
    selectedTrialLetter: selected,
  };
}
