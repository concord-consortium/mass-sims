import { beforeEach, describe, expect, it } from "vitest";
import {
  resetAll,
  resetSeededRandom,
  restoreSeededRandom,
  saveSeededRandom,
  seededRandom,
} from "./seeded-random";

describe("seeded-random", () => {
  beforeEach(() => {
    resetAll();
  });

  it("returns deterministic sequences keyed by string", () => {
    const fooResults: number[] = [];
    const barResults: number[] = [];
    for (let i = 0; i < 3; ++i) {
      fooResults.push(seededRandom("foo")());
      barResults.push(seededRandom("bar")());
    }
    expect(fooResults).not.toEqual(barResults);

    // Resetting and re-running with the same keys produces the same sequences.
    resetSeededRandom("foo");
    resetSeededRandom("bar");
    const fooRound2 = [seededRandom("foo")(), seededRandom("foo")(), seededRandom("foo")()];
    const barRound2 = [seededRandom("bar")(), seededRandom("bar")(), seededRandom("bar")()];
    expect(fooRound2).toEqual(fooResults);
    expect(barRound2).toEqual(barResults);
  });

  it("can save and restore PRNG state", () => {
    const baz = seededRandom("baz");
    baz();
    baz();
    baz();
    const savedState = saveSeededRandom("baz");
    const before = [baz(), baz(), baz()];

    resetSeededRandom("baz");
    restoreSeededRandom("baz", savedState);
    const after = [seededRandom("baz")(), seededRandom("baz")(), seededRandom("baz")()];
    expect(after).toEqual(before);
  });

  it("throws when asked to save state for a key that has never been requested", () => {
    expect(() => saveSeededRandom("never-seen")).toThrow();
  });

  it("returns the same instance for repeat calls with the same key", () => {
    const a = seededRandom("same");
    const b = seededRandom("same");
    expect(a).toBe(b);
  });
});
