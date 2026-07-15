import { describe, expect, it } from "vitest";
import type { SimOutput } from "../model/types";
import { emptyTrialSnapshot, makeSeed, TrialModel } from "./trial-model";

// A recorded output has no fields yet (the Nor'easter model story adds them), so it's an empty
// object — enough to flip the trial into the "has run" state.
const OUTPUT: SimOutput = {};

describe("TrialModel", () => {
  it("starts with no output (not yet run)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    expect(trial.output).toBeNull();
    expect(trial.hasOutput).toBe(false);
  });

  it("records output via setOutput", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    trial.setOutput(OUTPUT);
    expect(trial.output).toEqual(OUTPUT);
    expect(trial.hasOutput).toBe(true);
  });

  it("reset clears output but keeps input (and its seed)", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-keep"));
    trial.setOutput(OUTPUT);
    trial.reset();
    expect(trial.output).toBeNull();
    expect(trial.input.seed).toBe(emptyTrialSnapshot("seed-keep").input.seed);
  });

  it("setInput replaces the input wholesale", () => {
    const trial = TrialModel.create(emptyTrialSnapshot("seed-1"));
    trial.setInput({ seed: "seed-2" });
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
