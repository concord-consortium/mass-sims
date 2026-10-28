import { type Instance, type SnapshotOut, types } from "mobx-state-tree";
import type { Sample } from "../model/types";

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * One trial's samples: the rows of its data table, in the order the student took them. A trial's
 * identity is its letter (its key in the root store's `trials` map), and its conditions are fixed
 * per letter in `trial-conditions.ts`, so neither is stored here.
 *
 * Samples are `types.frozen` because a sample is read and replaced whole, never edited. The same
 * year can be sampled twice, so each sample gets an `id` from `nextSampleId`. The counter is in the
 * snapshot, so restored rows and new rows never share an id. Ids are unique only within a trial.
 */
export const TrialModel = types
  .model("Trial", {
    samples: types.array(types.frozen<Sample>()),
    nextSampleId: types.optional(types.number, 1),
  })
  .views((self) => ({
    get sampleCount(): number {
      return self.samples.length;
    },
    get hasSamples(): boolean {
      return self.samples.length > 0;
    },
    /** The mean reported rate, or `null` when the trial has no samples. */
    get averageRate(): number | null {
      return mean(self.samples.map((s) => s.rate));
    },
    /** The mean rock above the cave, or `null` when the trial has no samples. */
    get averageRoof(): number | null {
      return mean(self.samples.map((s) => s.roof));
    },
    sampleById(id: number): Sample | undefined {
      return self.samples.find((s) => s.id === id);
    },
  }))
  .actions((self) => ({
    /** Gives the sample the next id, appends it, and returns the stored row. */
    addSample(sample: Omit<Sample, "id">): Sample {
      const stored: Sample = { ...sample, id: self.nextSampleId };
      self.samples.push(stored);
      self.nextSampleId += 1;
      return stored;
    },
    /** Removes the sample with this id. Returns `false` if there is none. */
    deleteSample(id: number): boolean {
      const index = self.samples.findIndex((s) => s.id === id);
      if (index < 0) return false;
      self.samples.splice(index, 1);
      return true;
    },
    /** Clears the samples. The id counter keeps counting. */
    reset() {
      self.samples.clear();
    },
  }));

export type TrialModelInstance = Instance<typeof TrialModel>;

/** The per-trial saved-state format, derived from `TrialModel` so the two can't drift apart. */
export type TrialState = SnapshotOut<typeof TrialModel>;

/** A factory, not a constant, so trials never share one mutable snapshot. */
export function emptyTrialSnapshot(): TrialState {
  return { samples: [], nextSampleId: 1 };
}
