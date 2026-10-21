import {
  hasAnyProgress as anyTrialHasProgress,
  trialLetters as listTrialLetters,
  activeTrial as resolveActiveTrial,
  UiStore,
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
    // Collapse's four trials are fixed at creation, so there is never a trial to add.
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
 * Create a root store seeded with the four empty trials A–D, in that order, with A selected. The
 * `rng` makes each trial's seed; it is also passed as MST's *environment* (the second `create`
 * argument). Production omits `rng` (defaults to `Math.random`); tests pass a seeded PRNG for
 * determinism.
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

// Re-exported so callers (and the snapshot/hydrate path) have a single import site for snapshots.
export { getSnapshot };
