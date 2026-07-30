import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Outcome } from "../model/weather";
import { type PillPhaseInput, usePillPhase } from "./use-pill-phase";

// A steady baseline (nothing run yet); each test rerenders from here to drive one transition.
const EMPTY: PillPhaseInput = {
  runningHere: false,
  replay: false,
  outcome: null,
  runId: 0,
  runCompletedToken: 0,
};

function driver(initial: PillPhaseInput = EMPTY) {
  return renderHook((props: PillPhaseInput) => usePillPhase(props), { initialProps: initial });
}

describe("usePillPhase — phase", () => {
  it("is 'empty' with no outcome and no run", () => {
    expect(driver().result.current.phase).toBe("empty");
  });

  it("is 'filled' with a committed outcome and no run", () => {
    const { result } = driver({ ...EMPTY, outcome: "strong" as Outcome });
    expect(result.current.phase).toBe("filled");
  });

  it("is 'simulating' during a first run (outcome still null)", () => {
    const { result } = driver({ ...EMPTY, runningHere: true, runId: 1 });
    expect(result.current.phase).toBe("simulating");
  });

  it("is 'simulating-replay' during a replay (outcome already committed)", () => {
    const { result } = driver({
      ...EMPTY,
      runningHere: true,
      replay: true,
      outcome: "strong" as Outcome,
      runId: 2,
    });
    expect(result.current.phase).toBe("simulating-replay");
  });
});

describe("usePillPhase — transition provenance", () => {
  it("starts 'instant' (nothing has changed since mount)", () => {
    expect(driver().result.current.transition).toBe("instant");
  });

  it("is 'instant' when mounted mid-run (the start edge predates mount)", () => {
    // Seeding to the mounted counters means a remount into a running trial doesn't spuriously re-animate.
    const { result } = driver({ ...EMPTY, runningHere: true, runId: 1 });
    expect(result.current.transition).toBe("instant");
    expect(result.current.phase).toBe("simulating");
  });

  it("is 'start' when a run arms (runId advances)", () => {
    const { result, rerender } = driver();
    rerender({ ...EMPTY, runningHere: true, runId: 1 });
    expect(result.current.transition).toBe("start");
    expect(result.current.phase).toBe("simulating");
  });

  it("is 'complete' when a run finalizes (runCompletedToken advances)", () => {
    const { result, rerender } = driver({ ...EMPTY, runningHere: true, runId: 1 });
    // Finalize: run clears, outcome commits, token advances.
    rerender({ ...EMPTY, outcome: "strong" as Outcome, runId: 1, runCompletedToken: 1 });
    expect(result.current.transition).toBe("complete");
    expect(result.current.phase).toBe("filled");
  });

  it("is 'complete' on a REPLAY finalize too (token advances, outcome unchanged)", () => {
    // A run already completed once (outcome committed, token at 1).
    const base: PillPhaseInput = {
      ...EMPTY,
      outcome: "strong" as Outcome,
      runId: 1,
      runCompletedToken: 1,
    };
    const { result, rerender } = driver(base);
    // Replay begins (runId advances) then finalizes (token advances, same outcome).
    rerender({ ...base, runningHere: true, replay: true, runId: 2 });
    expect(result.current.transition).toBe("start");
    rerender({ ...base, runId: 2, runCompletedToken: 2 });
    expect(result.current.transition).toBe("complete");
    expect(result.current.phase).toBe("filled");
  });

  it("is 'instant' on a trial switch (shown outcome changes, neither counter advances)", () => {
    const base: PillPhaseInput = {
      ...EMPTY,
      outcome: "strong" as Outcome,
      runId: 1,
      runCompletedToken: 1,
    };
    const { result, rerender } = driver(base);
    // Switch to another already-run trial: outcome changes, counters unchanged.
    rerender({ ...base, outcome: "fair" as Outcome });
    expect(result.current.transition).toBe("instant");
    expect(result.current.phase).toBe("filled");
  });

  it("is 'instant' when a FIRST run is CANCELED before completion (outcome stays null)", () => {
    // The subtle case: a first run defers its outcome, so canceling it (Reset / switch to an unrun trial)
    // advances NEITHER counter AND leaves outcome null — only the running true→false edge signals the end.
    const { result, rerender } = driver();
    rerender({ ...EMPTY, runningHere: true, runId: 1 }); // first run begins → start
    expect(result.current.transition).toBe("start");
    rerender({ ...EMPTY, runId: 1 }); // reset before finalize: not running, outcome still null, no bumps
    expect(result.current.transition).toBe("instant");
    expect(result.current.phase).toBe("empty");
  });

  it("is 'instant' when a run is CANCELED, not completed (no token bump)", () => {
    // Start from an already-run trial, then drive the replay-start edge after mount (mounting mid-run
    // would correctly seed to 'instant', so the edge has to happen post-mount to be observed).
    const base: PillPhaseInput = {
      ...EMPTY,
      outcome: "strong" as Outcome,
      runId: 1,
      runCompletedToken: 1,
    };
    const { result, rerender } = driver(base);
    rerender({ ...base, runningHere: true, replay: true, runId: 2 }); // replay begins → start
    expect(result.current.transition).toBe("start");
    // Cancel by switching to another already-run trial: run clears, outcome changes to the new trial's,
    // token does NOT advance. Must NOT read as a completion.
    rerender({ ...EMPTY, outcome: "fair" as Outcome, runId: 2, runCompletedToken: 1 });
    expect(result.current.transition).toBe("instant");
    expect(result.current.phase).toBe("filled");
  });
});
