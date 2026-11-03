import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import type { Instance } from "mobx-state-tree";
import { TIMELINE_VALUES } from "../model/timeline";
import type { SortKey, SortState } from "../model/types";

/**
 * Per-session UI state: the shared `UiStore` base plus the timeline's chosen value, each trial's
 * selected row, the table's sort, and the Compare Trials view.
 *
 * `timelineIndex` is an index into `TIMELINE_VALUES`, shared by all trials. Change it through
 * `useSetSampleYears`, which also logs the change.
 *
 * `selectedSampleByTrial` maps a trial letter to the id of its selected sample. `sort` is one state
 * for all four trials, so switching trials keeps the columns comparable.
 *
 * `compareOpen` says whether the Compare Trials view is showing. `pinnedYear` is the year that view
 * highlights in every trial. Open the view through the root store's `openCompare`, which seeds the
 * pin from the selected row.
 *
 * All of these are `.volatile`, so they are not in snapshots: they are not saved, and restoring saved
 * state with `applySnapshot` does not reset them. A volatile value is observed by reference, so
 * every write replaces the object.
 */
export const UiStore = BaseUiStore.volatile(() => ({
  timelineIndex: 0,
  selectedSampleByTrial: {} as Readonly<Record<string, number>>,
  sort: { key: null, direction: 1 } as SortState,
  compareOpen: false,
  pinnedYear: null as number | null,
}))
  .views((self) => ({
    /** The chosen sample time, in years before collapse. */
    get sampleYears(): number {
      return TIMELINE_VALUES[self.timelineIndex];
    },
    get canStepEarlier(): boolean {
      return self.timelineIndex > 0;
    },
    get canStepLater(): boolean {
      return self.timelineIndex < TIMELINE_VALUES.length - 1;
    },
    /** The id of the trial's selected sample, or `null`. The id may name a deleted sample. */
    selectedSampleId(letter: string): number | null {
      return self.selectedSampleByTrial[letter] ?? null;
    },
    isPinned(years: number): boolean {
      return self.pinnedYear === years;
    },
  }))
  .actions((self) => ({
    setTimelineIndex(i: number) {
      self.timelineIndex = Math.min(Math.max(i, 0), TIMELINE_VALUES.length - 1);
    },
    /** Selects the trial's sample `id`, or clears the trial's selection with `null`. */
    selectSample(letter: string, id: number | null) {
      const { [letter]: _previous, ...rest } = self.selectedSampleByTrial;
      self.selectedSampleByTrial = id === null ? rest : { ...rest, [letter]: id };
    },
    /** Clears every trial's selection. */
    clearSampleSelections() {
      self.selectedSampleByTrial = {};
    },
    /** Ascending → descending → not sorted. A different key starts at ascending. */
    cycleSort(key: SortKey) {
      const { key: current, direction } = self.sort;
      if (current !== key) self.sort = { key, direction: 1 };
      else if (direction === 1) self.sort = { key, direction: -1 };
      else self.sort = { key: null, direction: 1 };
    },
    /** Opens the view with `pinnedYear` pinned, or no pin for `null`. */
    showCompare(pinnedYear: number | null) {
      self.compareOpen = true;
      self.pinnedYear = pinnedYear;
    },
    /** Closes the view. The pin stays until the next open replaces it. */
    closeCompare() {
      self.compareOpen = false;
    },
    /** Pins `years`. Pinning the pinned year clears the pin. */
    togglePin(years: number) {
      self.pinnedYear = self.pinnedYear === years ? null : years;
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
