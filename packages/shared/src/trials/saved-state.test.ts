import { describe, expect, it } from "vitest";
import type { TrialLetter } from "./constants";
import { toVersionedSavedState } from "./saved-state";

describe("toVersionedSavedState", () => {
  it("projects the flat envelope from a root snapshot, dropping extra UI state", () => {
    const snap = {
      trials: { A: { foo: 1 }, B: { foo: 2 } },
      // A sim's UiStore may carry extra transient fields beyond `selectedTrialLetter`; the projection
      // drops all of them. Using a generic name (not a real sim's field) keeps that intent clear.
      ui: { selectedTrialLetter: "B" as TrialLetter, someExtraUiState: 42 },
    };
    expect(toVersionedSavedState(1, snap)).toEqual({
      version: 1,
      trials: { A: { foo: 1 }, B: { foo: 2 } },
      selectedTrialLetter: "B",
    });
  });

  it("carries the version through verbatim", () => {
    const snap = { trials: {}, ui: { selectedTrialLetter: "A" as TrialLetter } };
    expect(toVersionedSavedState(3, snap).version).toBe(3);
  });
});
