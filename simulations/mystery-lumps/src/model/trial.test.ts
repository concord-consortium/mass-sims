import { describe, expect, it } from "vitest";
import {
  applyTest,
  clearTrial,
  makeEmptyTrial,
  markHandled,
  markWafted,
  resetLumpTest,
  untestedLumps,
} from "./trial";

describe("trial", () => {
  it("starts with five lumps, none touched", () => {
    const trial = makeEmptyTrial();
    expect(untestedLumps(trial)).toEqual(["A", "B", "C", "D", "E"]);
    expect(trial.lumps.A).toEqual({
      handled: { before: false, after: false },
      wafted: { before: false, after: false },
      result: null,
    });
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
    expect(trial.lumps.D.handled).toEqual({ before: false, after: true });
    expect(trial.lumps.D.wafted).toEqual({ before: false, after: true });
    expect(trial.lumps.D.result).toEqual({ test: "lamp", setting: "day" });
  });

  it("keeps a before and an after observation apart", () => {
    // The pair is the argument: waxy and pale beforehand, a greasy pool after the bath.
    let trial = markHandled(makeEmptyTrial(), "D");
    trial = applyTest(trial, "D", "bath", "60");
    trial = markHandled(trial, "D");
    expect(trial.lumps.D.handled).toEqual({ before: true, after: true });
  });

  it("drops the post-test observations when the test is reset, and keeps the earlier ones", () => {
    let trial = markHandled(makeEmptyTrial(), "D");
    trial = applyTest(trial, "D", "bath", "60");
    trial = markWafted(markHandled(trial, "D"), "D");

    const back = resetLumpTest(trial, "D");
    // What was seen before the test still happened; what was seen after describes a lump that
    // no longer exists.
    expect(back.lumps.D.handled).toEqual({ before: true, after: false });
    expect(back.lumps.D.wafted).toEqual({ before: false, after: false });
    expect(back.lumps.D.result).toBeNull();
  });

  it("clears a trial in place, keeping its id", () => {
    const trial = markHandled(applyTest(makeEmptyTrial(), "A", "water", null), "B");
    const cleared = clearTrial(trial);
    expect(cleared.id).toBe(trial.id);
    expect(untestedLumps(cleared)).toHaveLength(5);
    expect(cleared.lumps.B.handled).toEqual({ before: false, after: false });
  });

  it("does not mutate the trial it was given", () => {
    const before = makeEmptyTrial();
    applyTest(before, "A", "water", null);
    expect(before.lumps.A.result).toBeNull();
  });
});
