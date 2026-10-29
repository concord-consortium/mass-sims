import { describe, expect, it } from "vitest";
import { emptyTrialSnapshot, TrialModel } from "./trial-model";

const row = (years: number, rate: number, roof: number) => ({ years, rate, roof });

describe("TrialModel", () => {
  it("starts with no samples", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    expect(trial.sampleCount).toBe(0);
    expect(trial.hasSamples).toBe(false);
    expect(trial.nextSampleId).toBe(1);
  });

  it("addSample assigns ids 1, 2, 3 and returns the stored row", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    const a = trial.addSample(row(200000, 30, 8800));
    const b = trial.addSample(row(200000, 31, 8800));
    const c = trial.addSample(row(0, 29, 2800));
    expect([a.id, b.id, c.id]).toEqual([1, 2, 3]);
    expect(c).toEqual({ id: 3, years: 0, rate: 29, roof: 2800 });
    expect(trial.samples[2]).toEqual(c);
    expect(trial.sampleCount).toBe(3);
    expect(trial.hasSamples).toBe(true);
    expect(trial.sampleById(2)).toEqual(b);
  });

  it("deleteSample removes by id and returns false for an unknown id", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.addSample(row(200000, 30, 8800));
    trial.addSample(row(100000, 30, 5800));
    expect(trial.deleteSample(1)).toBe(true);
    expect(trial.samples.map((s) => s.id)).toEqual([2]);
    expect(trial.deleteSample(1)).toBe(false);
    expect(trial.deleteSample(99)).toBe(false);
    expect(trial.sampleById(1)).toBeUndefined();
  });

  it("reset empties the rows and does not reset the id counter", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    trial.addSample(row(200000, 30, 8800));
    trial.addSample(row(100000, 30, 5800));
    trial.reset();
    expect(trial.hasSamples).toBe(false);
    expect(trial.addSample(row(0, 30, 2800)).id).toBe(3);
  });

  it("averages are null when empty and the plain mean otherwise", () => {
    const trial = TrialModel.create(emptyTrialSnapshot());
    expect(trial.averageRate).toBeNull();
    expect(trial.averageRoof).toBeNull();
    trial.addSample(row(200000, 30, 8800));
    trial.addSample(row(100000, 24, 5800));
    trial.addSample(row(0, 33, 2800));
    expect(trial.averageRate).toBe(29);
    expect(trial.averageRoof).toBe(5800);
  });

  it("emptyTrialSnapshot returns a new object each call", () => {
    expect(emptyTrialSnapshot()).not.toBe(emptyTrialSnapshot());
    expect(emptyTrialSnapshot()).toEqual({ samples: [], nextSampleId: 1 });
  });
});
