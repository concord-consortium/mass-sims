import { type Instance, type SnapshotOut, types } from "mobx-state-tree";
import type { SimInput, SimOutput, SimTransient } from "../model/types";

export const DEFAULT_PARAMS = { walkerCount: 50, stepSize: 1, framesPerTrial: 200 } as const;

/**
 * One trial's state, still the placeholder random-walk shape. A trial's identity is its letter (its
 * key in the root store's `trials` map), so there is no `id` field. The fields are `types.frozen`
 * because they are always read and replaced whole, never edited in place through MST.
 */
export const TrialModel = types
  .model("Trial", {
    input: types.frozen<SimInput>(),
    output: types.maybeNull(types.frozen<SimOutput>()),
    finalTransient: types.maybeNull(types.frozen<SimTransient>()),
  })
  .views((self) => ({
    get hasOutput(): boolean {
      return self.output !== null;
    },
  }))
  .actions((self) => ({
    setInput(input: SimInput) {
      self.input = input;
    },
    setOutput(output: SimOutput, finalTransient: SimTransient) {
      self.output = output;
      self.finalTransient = finalTransient;
    },
    /** Clears the recorded result, keeping the input and its seed. */
    reset() {
      self.output = null;
      self.finalTransient = null;
    },
  }));

export type TrialModelInstance = Instance<typeof TrialModel>;

/** The per-trial saved-state format, derived from `TrialModel` so the two can't drift apart. */
export type TrialState = SnapshotOut<typeof TrialModel>;

/** A seed string from the injected RNG, so tests with a seeded PRNG get deterministic trials. */
export function makeSeed(rng: () => number): string {
  return `trial-${rng().toString(36).slice(2, 10)}`;
}

/**
 * A factory, not a constant, so trials never share one mutable snapshot. Each call gets its own
 * seed, so trials with the same parameters still run different walks.
 */
export function emptyTrialSnapshot(seed: string) {
  return {
    input: { ...DEFAULT_PARAMS, seed },
    output: null,
    finalTransient: null,
  };
}
