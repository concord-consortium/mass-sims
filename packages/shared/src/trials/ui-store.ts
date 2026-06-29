import { type Instance, types } from "mobx-state-tree";
import { TRIAL_LETTERS_DEFAULT, type TrialLetter } from "./constants";

/**
 * The shared base for a sim's transient, per-session UI state. Holds only the universal piece —
 * which trial letter is active — so it is the actual common subset across sims. Sims that need more
 * per-trial UI state (e.g. Bananas's per-trial cross-row selection) compose ON TOP of this base via
 * `types.compose` rather than duplicating `selectedTrialLetter`.
 *
 * NOT serialized to LARA — only the `trials` map is persisted; UI state resets across reloads.
 */
export const UiStore = types
  .model("Ui", {
    /**
     * The currently-active trial letter. Restricted to A–J at the MST level — `types.enumeration`
     * rejects anything else at runtime when an action writes it or `applySnapshot` hydrates it. The
     * compile-time `TrialLetter` alias keeps consumers honest too. Defaults to "A" (always seeded).
     */
    selectedTrialLetter: types.optional(
      types.enumeration("TrialLetter", [...TRIAL_LETTERS_DEFAULT]),
      "A",
    ),
  })
  .actions((self) => ({
    selectTrial(letter: string) {
      // Cast at the boundary: callers pass a plain string, but the property is the A–J enumeration.
      // The enumeration still validates at runtime — an out-of-range letter throws on assignment.
      self.selectedTrialLetter = letter as TrialLetter;
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
