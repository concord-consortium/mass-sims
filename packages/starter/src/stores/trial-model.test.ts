import { describe, expect, it } from "vitest";
import type { SimOutput, SimTransient } from "../model/types";
import { emptyTrialSnapshot, makeSeed, TrialModel } from "./trial-model";

const OUTPUT: SimOutput = { avgDistance: 12.3, stdDevDistance: 2.1, avgDistanceSeries: [1, 2, 3] };
const TRANSIENT: SimTransient = {
  frame: 200,
  walkers: [{ x: 3, y: 4 }],
  avgDistanceSeries: [1, 2, 3],
};

describe("TrialModel", () => {
  it("starts with no output (not yet run)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    expect(trial.output).toBeNull();
    expect(trial.finalTransient).toBeNull();
    expect(trial.hasOutput).toBe(false);
  });

  it("records output + finalTransient via setOutput", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    trial.setOutput(OUTPUT, TRANSIENT);
    expect(trial.output).toEqual(OUTPUT);
    expect(trial.finalTransient).toEqual(TRANSIENT);
    expect(trial.hasOutput).toBe(true);
  });

  it("reset clears output + finalTransient but keeps input (and its seed)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-keep"));
    trial.setOutput(OUTPUT, TRANSIENT);
    trial.reset();
    expect(trial.output).toBeNull();
    expect(trial.finalTransient).toBeNull();
    expect(trial.input.seed).toBe(emptyTrialSnapshot("seed-keep").input.seed);
  });

  it("setInput replaces the input wholesale", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    trial.setInput({ walkerCount: 100, stepSize: 2, framesPerTrial: 300, seed: "seed-2" });
    expect(trial.input.walkerCount).toBe(100);
    expect(trial.input.seed).toBe("seed-2");
  });
});

describe("makeSeed", () => {
  it("is deterministic for a given RNG sequence", () => {
    const seqA = [0.1, 0.2, 0.3];
    const seqB = [0.1, 0.2, 0.3];
    const rngA = () => seqA.shift() ?? 0;
    const rngB = () => seqB.shift() ?? 0;
    expect(makeSeed(rngA)).toBe(makeSeed(rngB));
  });

  it("varies as the RNG advances", () => {
    const seq = [0.111111, 0.999999];
    const rng = () => seq.shift() ?? 0;
    expect(makeSeed(rng)).not.toBe(makeSeed(rng));
  });

  it("prefixes the seed with 'trial-'", () => {
    expect(makeSeed(() => 0.5)).toMatch(/^trial-/);
  });
});
