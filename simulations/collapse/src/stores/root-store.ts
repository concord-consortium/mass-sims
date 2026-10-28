import {
  hasAnyProgress as anyTrialHasProgress,
  trialLetters as listTrialLetters,
  activeTrial as resolveActiveTrial,
} from "@concord-consortium/mass-sims-shared";
import {
  getEnv,
  getSnapshot,
  type Instance,
  type SnapshotIn,
  type SnapshotOut,
  types,
} from "mobx-state-tree";
import { createContext, createElement, type ReactNode, useContext } from "react";
import { sampleAt } from "../model/erosion";
import type { Sample } from "../model/types";
import {
  COLLAPSE_TRIAL_LETTERS,
  type CollapseTrialLetter,
  TRIAL_CONDITIONS,
} from "../trial-conditions";
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

export const RootStore = types
  .model("Root", {
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .views((self) => ({
    get activeTrial(): TrialModelInstance {
      return resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
    },
    /** The active trial's selected sample. A selection that names a deleted id reads as none. */
    get selectedSample(): Sample | undefined {
      const id = self.ui.selectedSampleId(self.ui.selectedTrialLetter);
      return id === null ? undefined : self.trials.get(self.ui.selectedTrialLetter)?.sampleById(id);
    },
    // The four trials are fixed at creation.
    get canAddTrial(): boolean {
      return false;
    },
    get trialLetters(): readonly string[] {
      return listTrialLetters(self.trials);
    },
    get hasAnyProgress(): boolean {
      return anyTrialHasProgress(self.trials, (trial) => trial.hasSamples);
    },
  }))
  .actions((self) => ({
    /**
     * Samples the active trial at the timeline's year and selects the new row. Returns the stored
     * sample, so the caller can announce and log it. The RNG comes from the MST environment.
     */
    takeSample(): Sample {
      const letter = self.ui.selectedTrialLetter;
      const { rng } = getEnv<{ rng: () => number }>(self);
      const conditions = TRIAL_CONDITIONS[letter as CollapseTrialLetter];
      const sample = self.activeTrial.addSample(sampleAt(conditions, self.ui.sampleYears, rng));
      self.ui.selectSample(letter, sample.id);
      return sample;
    },
    /** Deletes the trial's sample `id`, and clears the trial's selection if it named that id. */
    deleteSample(letter: string, id: number) {
      self.trials.get(letter)?.deleteSample(id);
      if (self.ui.selectedSampleId(letter) === id) self.ui.selectSample(letter, null);
    },
    resetTrial(letter?: string) {
      const target = letter ?? self.ui.selectedTrialLetter;
      const trial = self.trials.get(target);
      if (!trial) return;
      trial.reset();
      self.ui.selectSample(target, null);
    },
  }));

export type RootStoreInstance = Instance<typeof RootStore>;
export type RootStoreSnapshotIn = SnapshotIn<typeof RootStore>;
export type RootStoreSnapshotOut = SnapshotOut<typeof RootStore>;

/**
 * A root store with four empty trials A–D, in that order, and A selected. `rng` is the MST
 * environment that `takeSample` reads; tests pass a seeded PRNG for determinism.
 */
export function createRootStore({ rng = Math.random }: { rng?: () => number } = {}) {
  return RootStore.create(
    {
      trials: Object.fromEntries(
        COLLAPSE_TRIAL_LETTERS.map((letter) => [letter, emptyTrialSnapshot()]),
      ),
      ui: { selectedTrialLetter: "A" },
    },
    { rng },
  );
}

const RootStoreContext = createContext<RootStoreInstance | null>(null);

export function RootStoreProvider({
  store,
  children,
}: {
  store: RootStoreInstance;
  children: ReactNode;
}) {
  return createElement(RootStoreContext.Provider, { value: store }, children);
}

export function useStores(): RootStoreInstance {
  const store = useContext(RootStoreContext);
  if (!store) throw new Error("useStores() called outside RootStoreProvider");
  return store;
}

// Re-exported so callers have one import site for snapshots.
export { getSnapshot };
