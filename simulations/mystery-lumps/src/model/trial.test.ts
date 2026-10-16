import { describe, expect, it } from "vitest";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markHandled,
  markWafted,
  untestedLumps,
} from "./trial";

describe("trial", () => {
  it("starts with five lumps, none touched", () => {
    const trial = makeEmptyTrial();
    expect(untestedLumps(trial)).toEqual(["A", "B", "C", "D", "E"]);
    expect(trial.lumps.A).toEqual({ handled: false, wafted: false, result: null });
  });

  it("spends a lump's one shot, and offers it no more", () => {
    const trial = applyTest(makeEmptyTrial(), "C", "lamp", "fortnight");
    expect(trial.lumps.C.result).toEqual({ test: "lamp", setting: "fortnight" });
    expect(untestedLumps(trial)).toEqual(["A", "B", "D", "E"]);
  });

  it("refuses a second destructive test on the same lump", () => {
    const once = applyTest(makeEmptyTrial(), "C", "lamp", "fortnight");
    const twice = applyTest(once, "C", "vinegar", null);
    expect(twice.lumps.C.result).toEqual({ test: "lamp", setting: "fortnight" });
    expect(twice).toBe(once); // unchanged, same reference
  });

  it("lets a lump be handled and wafted even after its test is spent", () => {
    let trial = applyTest(makeEmptyTrial(), "D", "lamp", "day");
    trial = markWafted(markHandled(trial, "D"), "D");
    expect(trial.lumps.D).toMatchObject({ handled: true, wafted: true });
    expect(trial.lumps.D.result).toEqual({ test: "lamp", setting: "day" });
  });

  it("clears a trial in place, keeping its id", () => {
    const trial = markHandled(applyTest(makeEmptyTrial(), "A", "water", null), "B");
    const cleared = clearTrial(trial);
    expect(cleared.id).toBe(trial.id);
    expect(untestedLumps(cleared)).toHaveLength(5);
    expect(cleared.lumps.B.handled).toBe(false);
  });

  it("does not mutate the trial it was given", () => {
    const before = makeEmptyTrial();
    applyTest(before, "A", "water", null);
    expect(before.lumps.A.result).toBeNull();
  });
});
