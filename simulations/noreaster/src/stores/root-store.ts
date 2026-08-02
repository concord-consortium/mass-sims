import {
  addTrial as addTrialToMap,
  hasAnyProgress as anyTrialHasProgress,
  canAddTrial as computeCanAddTrial,
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
import { type AirMassSetup, evaluateOutcome, type Outcome } from "../model/weather";
import { emptyTrialSnapshot, TrialModel, type TrialModelInstance } from "./trial-model";
import { UiStore } from "./ui-store";

/** Result `finalizeRun` returns to the runner for analytics and narration. */
export interface FinalizedRun {
  trial: string;
  outcome: Outcome;
  replay: boolean;
  setup: AirMassSetup;
}

export const RootStore = types
  .model("Root", {
    trials: types.map(TrialModel),
    ui: UiStore,
  })
  .actions((self) => ({
    addTrial(): string | null {
      return addTrialToMap(self.trials, () => TrialModel.create(emptyTrialSnapshot()));
    },
    resetTrial(letter?: string) {
      const target = letter ?? self.ui.selectedTrialLetter;
      const trial = self.trials.get(target);
      if (!trial) return;
      // Cancel a run targeting this trial before clearing it — the Trials-panel reset calls this directly
      // (no explicit cancel), and otherwise `finalizeRun` would commit the captured outcome onto the
      // emptied trial.
      if (self.ui.run?.trial === target) self.ui.cancelRun();
      trial.reset();
    },
    /**
     * Begin a deferred run: capture the active trial's outcome from its setup without committing it (the
     * trial's `outcome` stays null through the map animation), arm the run descriptor, and return its
     * `runId`. Returns null unless the setup is complete. `finalizeRun` later commits exactly this captured
     * outcome.
     */
    beginRun(): number | null {
      // Resolve the letter once (falling back to the first trial when the selected letter dangles) and arm
      // with THAT letter, so the run can't target a nonexistent trial. On a replay reuse the recorded
      // outcome rather than re-evaluating, so a classifier change can't diverge the animation from the table.
      const selected = self.ui.selectedTrialLetter;
      const letter = self.trials.has(selected) ? selected : listTrialLetters(self.trials)[0];
      const trial = self.trials.get(letter);
      if (!trial) return null;
      const setup = trial.setup;
      if (!setup) return null;
      return self.ui.armRun(letter, trial.outcome ?? evaluateOutcome(setup), trial.hasRun, setup);
    },
    /**
     * Finalize the run identified by `runId`: commit the captured outcome via `recordOutcome` (never a
     * re-evaluation), arm the Data-panel fade, and clear the descriptor. Returns null when `runId` doesn't
     * match the live run, dropping a stale callback from a canceled or superseded run. Returns the
     * committed run so the runner can emit analytics and narration.
     */
    finalizeRun(runId: number): FinalizedRun | null {
      const run = self.ui.run;
      if (!run || run.runId !== runId) return null;
      const trial = self.trials.get(run.trial);
      if (trial) trial.recordOutcome(run.outcome);
      self.ui.markRunCompleted();
      self.ui.clearRun();
      return { trial: run.trial, outcome: run.outcome, replay: run.replay, setup: run.setup };
    },
    /** Cancel the in-progress run (Reset / abort). Guarded clear via the ui store. */
    cancelRun(runId?: number) {
      self.ui.cancelRun(runId);
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
      return anyTrialHasProgress(self.trials, (trial) => trial.canReset);
    },
  }));

export type RootStoreInstance = Instance<typeof RootStore>;
export type RootStoreSnapshotIn = SnapshotIn<typeof RootStore>;
export type RootStoreSnapshotOut = SnapshotOut<typeof RootStore>;

/**
 * Create a root store seeded with a single empty (unconfigured) trial "A". No RNG environment is
 * needed: a Nor'easter trial's outcome is fully determined by its air-mass selections (no
 * randomness), and a trial's identity is its letter.
 */
export function createRootStore() {
  return RootStore.create({
    trials: { A: emptyTrialSnapshot() },
    ui: { selectedTrialLetter: "A" },
  });
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
