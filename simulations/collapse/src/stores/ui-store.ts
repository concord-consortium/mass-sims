import { UiStore as BaseUiStore } from "@concord-consortium/mass-sims-shared";
import { type Instance, types } from "mobx-state-tree";
import { TIMELINE_VALUES } from "../model/timeline";

/**
 * Per-session UI state: the shared `UiStore` base plus the timeline's chosen value.
 *
 * `timelineIndex` is an index into `TIMELINE_VALUES`, shared by all trials. It is a real prop so MST
 * snapshots and reactions see it, but it never reaches saved state: `toSavedState` keeps only
 * `trials` and `selectedTrialLetter`, so it resets on reload. Change it through `useSetSampleYears`,
 * which also logs the change.
 */
export const UiStore = BaseUiStore.props({
  timelineIndex: types.optional(types.number, 0),
})
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
