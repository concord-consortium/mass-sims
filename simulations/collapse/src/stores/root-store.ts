import {
  hasAnyProgress as anyTrialHasProgress,
  trialLetters as listTrialLetters,
  activeTrial as resolveActiveTrial,
} from "@concord-consortium/mass-sims-shared";
import {
  getSnapshot,
  type Instance,
  type SnapshotIn,
  type SnapshotOut,
  types,
} from "mobx-state-tree";
import { createContext, createElement, type ReactNode, useContext } from "react";
import { COLLAPSE_TRIAL_LETTERS } from "../trial-conditions";
import { emptyTrialSnapshot, makeSeed, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

export const RootStore = types
  .model("Root", {
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .actions((self) => ({
    resetTrial(letter?: string) {
      const target = letter ?? self.ui.selectedTrialLetter;
      const trial = self.trials.get(target);
      if (trial) trial.reset();
    },
  }))
  .views((self) => ({
    get activeTrial(): TrialModelInstance {
      return resolveActiveTrial(self.trials, self.ui.selectedTrialLetter);
    },
    // The four trials are fixed at creation.
    get canAddTrial(): boolean {
      return false;
    },
    get trialLetters(): readonly string[] {
      return listTrialLetters(self.trials);
    },
    get hasAnyProgress(): boolean {
      return anyTrialHasProgress(self.trials, (trial) => trial.output !== null);
    },
  }));

export type RootStoreInstance = Instance<typeof RootStore>;
export type RootStoreSnapshotIn = SnapshotIn<typeof RootStore>;
export type RootStoreSnapshotOut = SnapshotOut<typeof RootStore>;

/**
 * A root store with four empty trials A–D, in that order, and A selected. `rng` makes each trial's
 * seed and is also the MST environment; tests pass a seeded PRNG for determinism.
 */
export function createRootStore({ rng = Math.random }: { rng?: () => number } = {}) {
  return RootStore.create(
    {
      trials: Object.fromEntries(
        COLLAPSE_TRIAL_LETTERS.map((letter) => [letter, emptyTrialSnapshot(makeSeed(rng))]),
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
