import { describe, expect, it } from "vitest";
import { MAX_TRIALS_DEFAULT, TRIAL_LETTERS_DEFAULT } from "./constants";

describe("trial constants", () => {
  it("provides A–J as the default letter list", () => {
    expect([...TRIAL_LETTERS_DEFAULT]).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });

  it("derives the cap from the letter list so they can't drift", () => {
    expect(MAX_TRIALS_DEFAULT).toBe(TRIAL_LETTERS_DEFAULT.length);
  });
});
