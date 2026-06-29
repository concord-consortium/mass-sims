import { MAX_TRIALS_DEFAULT, TRIAL_LETTERS_DEFAULT } from "./constants";

/**
 * Shared multi-trial logic, expressed as helper functions that operate on a sim's `trials` map.
 *
 * WHY helpers (not an MST factory / `types.compose` base): each sim supplies its OWN `TrialModel`
 * with a sim-specific shape, so the universal logic has to be generic over the trial instance type.
 * Plain functions generic over that type compose cleanly with MST v7's typing from inside each sim's
 * sim-local `.views`/`.actions`, where they are called with `self.trials` and `self.ui`. The API
 * surface is: `activeTrial`, `canAddTrial`, `trialLetters`, `hasAnyProgress(predicate)`, `addTrial()`.
 * NOT `resetTrial` — its cleanup side-effects are sim-specific, so each sim writes its own (the common
 * part is two lines).
 */

/**
 * The READ slice of an MST `types.map(TrialModel)` instance the view helpers depend on. Declared
 * structurally so callers pass `self.trials` directly with no cast; `T` is the sim's trial instance
 * type. Deliberately omits `set`: a contravariant `set(key, value: T)` here would pollute `T`'s
 * inference with the map's broader creation type, widening reads (e.g. an optional `boolean` field
 * would infer as `boolean | undefined`). `addTrial` adds `set` back in an intersection, where `T`
 * isn't read so the widening is harmless.
 */
export interface TrialsMap<T> {
  readonly size: number;
  get(key: string): T | undefined;
  has(key: string): boolean;
  keys(): IterableIterator<string>;
  values(): IterableIterator<T>;
  forEach(callback: (value: T) => void): void;
}

/**
 * The trial currently being displayed. NEVER throws on a dangling `selectedTrialLetter` — it falls
 * back to the first trial in the map (always "A" in practice, since A is seeded at creation and no
 * action removes trials). Read-side belt-and-suspenders so consumers can read it unconditionally and
 * never crash mid-render.
 */
export function activeTrial<T>(trials: TrialsMap<T>, selectedTrialLetter: string): T {
  const trial = trials.get(selectedTrialLetter);
  if (trial) return trial;
  const first = trials.values().next().value;
  if (!first) throw new Error("No trials in store — invariant violated");
  return first;
}

export function canAddTrial<T>(trials: TrialsMap<T>): boolean {
  return trials.size < MAX_TRIALS_DEFAULT;
}

export function trialLetters<T>(trials: TrialsMap<T>): readonly string[] {
  return Array.from(trials.keys());
}

/**
 * True if any trial has progress. Parameterized on a per-trial `isProgress` predicate so each sim
 * defines what "progress" means (Starter: `trial.output !== null`; Bananas: `trial.canReset`). Drives
 * the reload-warning hook — the user has unsaved work in *any* trial, not just the active one.
 */
export function hasAnyProgress<T>(
  trials: TrialsMap<T>,
  isProgress: (trial: T) => boolean,
): boolean {
  let any = false;
  trials.forEach((trial) => {
    if (isProgress(trial)) any = true;
  });
  return any;
}

/**
 * Add a trial at the next-available letter (first one in `TRIAL_LETTERS_DEFAULT` not already in the
 * map), up to the cap. Returns the new letter, or `null` if at cap — callers MUST gate on the return
 * value. Find-first-missing (not `trials.size`) so this stays correct if a future story ever
 * introduces gap-producing operations; today the two strategies are identical. The sim supplies
 * `createTrial`, which instantiates its own `TrialModel` (e.g. `TrialModel.create(emptySnapshot())`).
 */
export function addTrial<T>(
  trials: TrialsMap<T> & { set(key: string, value: T): unknown },
  createTrial: () => T,
): string | null {
  const nextLetter = TRIAL_LETTERS_DEFAULT.find((letter) => !trials.has(letter));
  if (!nextLetter) return null;
  trials.set(nextLetter, createTrial());
  return nextLetter;
}
