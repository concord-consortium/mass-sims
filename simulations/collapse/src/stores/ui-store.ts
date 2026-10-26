import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import type { Instance } from "mobx-state-tree";
import { TIMELINE_VALUES } from "../model/timeline";

/**
 * Per-session UI state: the shared `UiStore` base plus the timeline's chosen value.
 *
 * `timelineIndex` is an index into `TIMELINE_VALUES`, shared by all trials. It is `.volatile`, so
 * it is not in snapshots: it is not saved, and restoring saved state with `applySnapshot` does not
 * reset it. Change it through `useSetSampleYears`, which also logs the change.
 */
export const UiStore = BaseUiStore.volatile(() => ({
  timelineIndex: 0,
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
  }))
  .actions((self) => ({
    setTimelineIndex(i: number) {
      self.timelineIndex = Math.min(Math.max(i, 0), TIMELINE_VALUES.length - 1);
    },
  }));

export type UiStoreInstance = Instance<typeof UiStore>;
