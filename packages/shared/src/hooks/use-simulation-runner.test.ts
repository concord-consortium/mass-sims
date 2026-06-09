import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSimulationRunner } from "./use-simulation-runner";

describe("useSimulationRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in the paused state (isPlaying = false)", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    expect(result.current.isPlaying).toBe(false);
  });

  it("play() flips isPlaying to true and triggers onStep on subsequent frames", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => {
      vi.advanceTimersByTime(50); // multiple rAF ticks
    });
    expect(onStep).toHaveBeenCalled();
  });

  it("pause() flips isPlaying to false and stops onStep calls", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    act(() => {
      vi.advanceTimersByTime(50);
    });
    const beforePauseCallCount = onStep.mock.calls.length;
    act(() => result.current.pause());
    expect(result.current.isPlaying).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onStep.mock.calls.length).toBe(beforePauseCallCount);
  });

  it("step() invokes onStep exactly once with a synthetic delta and leaves isPlaying false", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.step());
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep.mock.calls[0][0]).toBeTypeOf("number");
    expect(result.current.isPlaying).toBe(false);
  });

  it("step() can be called repeatedly without entering the playing state", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => {
      result.current.step();
      result.current.step();
      result.current.step();
    });
    expect(onStep).toHaveBeenCalledTimes(3);
    expect(result.current.isPlaying).toBe(false);
  });

  it("calling play() while already playing is a no-op", () => {
    const onStep = vi.fn();
    const { result } = renderHook(() => useSimulationRunner({ onStep }));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
  });
});
