import { type Instance, type SnapshotOut, types } from "mobx-state-tree";
import type { SimInput, SimOutput, SimTransient } from "../model/types";

export const DEFAULT_PARAMS = { walkerCount: 50, stepSize: 1, framesPerTrial: 200 } as const;

/**
 * One trial's state. Sim-specific because the `input` / `output` / `finalTransient` shapes are
 * Starter-domain (a random walk). The trial's identity is its letter — the key in the RootStore's
 * `trials` map — so there is no `id` field.
 *
 * `input` / `output` / `finalTransient` are `types.frozen` plain objects: they are leaf data the UI
 * reads wholesale and the seeded run reproduces exactly, never partially-mutated through MST.
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
    /** Clear the recorded result back to "not yet run", keeping the input (and its fixed seed). */
    reset() {
      self.output = null;
      self.finalTransient = null;
    },
  }));

export type TrialModelInstance = Instance<typeof TrialModel>;

/**
 * The per-trial wire format, derived from `TrialModel` so it can't drift from the store.
 */
export type TrialState = SnapshotOut<typeof TrialModel>;

/**
 * Build a fresh seed string from an injected RNG. Seeds aren't security-sensitive; sourcing them
 * from the MST environment RNG (rather than `Math.random` inline) keeps trials deterministic under a
 * seeded PRNG in tests while staying random in production.
 */
export function makeSeed(rng: () => number): string {
  return `trial-${rng().toString(36).slice(2, 10)}`;
}

/**
 * Factory (not a shared constant): each call returns a fresh snapshot so resets and separate trials
 * never share a mutable object. The seed is generated up front from the caller's RNG so each trial
 * runs a distinct walk even with identical parameters.
 */
export function emptyTrialSnapshot(seed: string) {
  return {
    input: { ...DEFAULT_PARAMS, seed },
    output: null,
    finalTransient: null,
  };
}
