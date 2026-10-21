import {
  addTrial as addTrialToMap,
  hasAnyProgress as anyTrialHasProgress,
  canAddTrial as computeCanAddTrial,
  trialLetters as listTrialLetters,
  activeTrial as resolveActiveTrial,
  UiStore,
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
import { emptyTrialSnapshot, makeSeed, TrialModel, type TrialModelInstance } from "./trial-model";

export const RootStore = types
  .model("Root", {
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .actions((self) => ({
    addTrial(): string | null {
      const { rng } = getEnv<{ rng: () => number }>(self);
      return addTrialToMap(self.trials, () => TrialModel.create(emptyTrialSnapshot(makeSeed(rng))));
    },
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
    get canAddTrial(): boolean {
      return computeCanAddTrial(self.trials);
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
 * Create a root store seeded with a single empty trial "A". The `rng` is passed as MST's
 * *environment* (the second `create` argument) rather than a stored property; actions read it via
 * `getEnv(self)`. Production omits `rng` (defaults to `Math.random`); tests pass a seeded PRNG for
 * determinism.
 */
export function createRootStore({ rng = Math.random }: { rng?: () => number } = {}) {
  return RootStore.create(
    {
      trials: { A: emptyTrialSnapshot(makeSeed(rng)) },
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
