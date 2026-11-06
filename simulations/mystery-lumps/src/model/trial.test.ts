import { describe, expect, it } from "vitest";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markExamined,
  resetLumpTest,
  untestedLumps,
} from "./trial";

describe("trial", () => {
  it("starts with five lumps, none touched", () => {
    const trial = makeEmptyTrial();
    expect(untestedLumps(trial)).toEqual(["1", "2", "3", "4", "5"]);
    expect(trial.lumps["1"]).toEqual({
      examined: { before: false, after: false },
      result: null,
    });
  });

  it("spends a lump's one shot, and offers it no more", () => {
    const trial = applyTest(makeEmptyTrial(), "3", "lamp");
    expect(trial.lumps["3"].result).toEqual({ test: "lamp" });
    expect(untestedLumps(trial)).toEqual(["1", "2", "4", "5"]);
  });

  it("refuses a second destructive test on the same lump", () => {
    const once = applyTest(makeEmptyTrial(), "3", "lamp");
    const twice = applyTest(once, "3", "vinegar");
    expect(twice.lumps["3"].result).toEqual({ test: "lamp" });
    expect(twice).toBe(once); // unchanged, same reference
  });

  it("lets a lump be examined even after its test is spent", () => {
    let trial = applyTest(makeEmptyTrial(), "4", "lamp");
    trial = markExamined(trial, "4");
    expect(trial.lumps["4"].examined).toEqual({ before: false, after: true });
    expect(trial.lumps["4"].result).toEqual({ test: "lamp" });
  });

  it("keeps a before and an after observation apart", () => {
    // The pair is the argument: waxy and pale beforehand, a greasy pool after the bath.
    let trial = markExamined(makeEmptyTrial(), "4");
    trial = applyTest(trial, "4", "bath");
    trial = markExamined(trial, "4");
    expect(trial.lumps["4"].examined).toEqual({ before: true, after: true });
  });

  it("drops the post-test observations when the test is reset, and keeps the earlier ones", () => {
    let trial = markExamined(makeEmptyTrial(), "4");
    trial = applyTest(trial, "4", "bath");
    trial = markExamined(trial, "4");

    const back = resetLumpTest(trial, "4");
    // What was seen before the test still happened; what was seen after describes a lump that
    // no longer exists.
    expect(back.lumps["4"].examined).toEqual({ before: true, after: false });
    expect(back.lumps["4"].result).toBeNull();
  });

  it("clears a trial in place, keeping its id", () => {
    const trial = markExamined(applyTest(makeEmptyTrial(), "1", "water"), "2");
    const cleared = clearTrial(trial);
    expect(cleared.id).toBe(trial.id);
    expect(untestedLumps(cleared)).toHaveLength(5);
    expect(cleared.lumps["2"].examined).toEqual({ before: false, after: false });
  });

  it("does not mutate the trial it was given", () => {
    const before = makeEmptyTrial();
    applyTest(before, "1", "water");
    expect(before.lumps["1"].result).toBeNull();
  });
});
