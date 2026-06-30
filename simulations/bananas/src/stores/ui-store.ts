import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import { type Instance, types } from "mobx-state-tree";

/**
 * Per-session UI state. Composes the shared UiStore base (which provides `selectedTrialLetter` +
 * `selectTrial`) with Bananas's per-trial cross-row selection. `selectedTrialLetter` is persisted as
 * part of the saved state; `selectedCrossByTrial` is transient and NOT serialized to LARA. The shared
 * `selectTrial` only changes the active letter, so per-trial cross memory survives a selection change.
 */
export const UiStore = types
  .compose(
    "Ui",
    BaseUiStore,
    types.model({
      /**
       * Per-trial cross-row selection, keyed by trial letter. An absent entry means "no cross
       * selected" for that trial (absence and `null` are the same observable state). Cross-row
       * selection is per-trial memory: switching A → B → A keeps A's highlighted cross.
       *
       * SELECTION ACCESS CONTRACT — required reading: no code outside `stores/` may read or index
       * `trial.crosses[...]` with this map directly. All such access goes through the
       * `RootStore.activeCross` view, which re-applies a bounds check on every read. The setters here
       * (`selectCross`/`clearSelection`/`clearSelectionForTrial`) are mutators — those callsites are
       * fine; the bounds check belongs on the read side.
       */
      selectedCrossByTrial: types.map(types.number),
    }),
  )
  .actions((self) => ({
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
