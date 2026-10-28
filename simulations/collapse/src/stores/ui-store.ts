import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import type { Instance } from "mobx-state-tree";
import { TIMELINE_VALUES } from "../model/timeline";
import type { SortKey, SortState } from "../model/types";

/**
 * Per-session UI state: the shared `UiStore` base plus the timeline's chosen value, each trial's
 * selected row, and the table's sort.
 *
 * `timelineIndex` is an index into `TIMELINE_VALUES`, shared by all trials. Change it through
 * `useSetSampleYears`, which also logs the change.
 *
 * `selectedSampleByTrial` maps a trial letter to the id of its selected sample. `sort` is one state
 * for all four trials, so switching trials keeps the columns comparable.
 *
 * All three are `.volatile`, so they are not in snapshots: they are not saved, and restoring saved
 * state with `applySnapshot` does not reset them. A volatile value is observed by reference, so
 * every write replaces the object.
 */
export const UiStore = BaseUiStore.volatile(() => ({
  timelineIndex: 0,
  selectedSampleByTrial: {} as Readonly<Record<string, number>>,
  sort: { key: null, direction: 1 } as SortState,
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
    /** Ascending → descending → not sorted. A different key starts at ascending. */
    cycleSort(key: SortKey) {
      const { key: current, direction } = self.sort;
      if (current !== key) self.sort = { key, direction: 1 };
      else if (direction === 1) self.sort = { key, direction: -1 };
      else self.sort = { key: null, direction: 1 };
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
