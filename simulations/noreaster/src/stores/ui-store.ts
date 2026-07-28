import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import type { Instance } from "mobx-state-tree";

/**
 * Per-session UI state: the shared `UiStore` base plus `runCompletedToken` — a `.volatile` counter
 * `control-bar.handleRun` bumps on each real Run. It's the Data-panel weather scene's "just finalized" signal
 * for fade-vs-instant, which can't be inferred from `outcome` alone (the same value arrives via Run,
 * hydration, or trial-switch). Volatile is load-bearing: it never enters the snapshot, so a restore isn't
 * read as a fresh Run and wrongly faded.
 */
export const UiStore = BaseUiStore.volatile(() => ({
  runCompletedToken: 0,
})).actions((self) => ({
  /** Bump the token — once per real Run, after the outcome is recorded. */
  markRunCompleted() {
    self.runCompletedToken += 1;
  },
}));

export type UiStoreInstance = Instance<typeof UiStore>;
