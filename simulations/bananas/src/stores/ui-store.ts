import { type Instance, types } from "mobx-state-tree";
import { TRIAL_LETTERS, type TrialLetter } from "../model/trials";

/**
 * Transient, per-session UI state. NOT serialized to LARA — only `trials` snapshots are.
 */
export const UiStore = types
  .model("Ui", {
    /**
     * The currently-active trial letter. Restricted to A–J at the MST level — `types.enumeration`
     * rejects anything else at runtime when an action writes it or `applySnapshot` hydrates it. The
     * compile-time `TrialLetter` alias keeps consumers honest too. Defaults to "A" (always seeded).
     */
    selectedTrialLetter: types.optional(types.enumeration("TrialLetter", [...TRIAL_LETTERS]), "A"),
    /**
     * Per-trial cross-row selection, keyed by trial letter. An absent entry means "no cross
     * selected" for that trial (absence and `null` are the same observable state). Cross-row
     * selection is per-trial memory: switching A → B → A keeps A's highlighted cross (Resolved #1).
     *
     * SELECTION ACCESS CONTRACT — required reading: no code outside `stores/` may read or index
     * `trial.crosses[...]` with this map directly. All such access goes through the
     * `RootStore.activeCross` view, which re-applies a bounds check on every read. The setters here
     * (`selectCross`/`clearSelection`/`clearSelectionForTrial`) are mutators — those callsites are
     * fine; the bounds check belongs on the read side.
     */
    selectedCrossByTrial: types.map(types.number),
  })
  .actions((self) => ({
    selectTrial(letter: string) {
      // Cast at the boundary: callers pass a plain string, but the property is the A–J enumeration.
      // The enumeration still validates at runtime — an out-of-range letter throws on assignment.
      self.selectedTrialLetter = letter as TrialLetter;
      // NOTE: do NOT clear selectedCrossByTrial — per-trial memory is the point.
    },
    selectCross(idx: number | null) {
      // Writes against the currently-active trial. `null` removes the entry rather than storing it,
      // so absence and `null` are the same observable state.
      const letter = self.selectedTrialLetter;
      if (idx === null) self.selectedCrossByTrial.delete(letter);
      else self.selectedCrossByTrial.set(letter, idx);
    },
    clearSelection() {
      self.selectedCrossByTrial.delete(self.selectedTrialLetter);
    },
    clearSelectionForTrial(letter: string) {
      self.selectedCrossByTrial.delete(letter);
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
