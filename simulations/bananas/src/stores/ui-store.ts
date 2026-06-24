import { type Instance, types } from "mobx-state-tree";

/**
 * Transient, per-session UI state. NOT serialized to LARA — only `trial` snapshots are.
 */
export const UiStore = types
  .model("Ui", {
    /**
     * Index of the currently-selected cross, or `null` for "all crosses".
     *
     * SELECTION ACCESS CONTRACT — required reading: no code outside `stores/` may read or index
     * `trial.crosses[...]` with this field directly. All such access goes through the
     * `RootStore.activeCross` view, which re-applies a bounds check on every read. Between the
     * moment `crosses` shrinks (Reset) and the moment the `normalizeSelection` reaction fires,
     * this value can be stale-but-out-of-range; reading it directly would crash. `selectCross`
     * and `clearSelection` are setters (mutators) — those callsites are fine; the bounds check
     * belongs on the read side.
     */
    selectedCross: types.maybeNull(types.number),
  })
  .actions((self) => ({
    selectCross(idx: number | null) {
      self.selectedCross = idx;
    },
    clearSelection() {
      self.selectedCross = null;
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
