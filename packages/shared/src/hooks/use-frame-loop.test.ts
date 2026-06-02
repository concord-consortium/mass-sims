import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFrameLoop } from "./use-frame-loop";

describe("useFrameLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the callback on each animation frame while enabled", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback, true));

    expect(callback).not.toHaveBeenCalled();

    // Each call to advanceTimersToNextFrame fires the scheduled rAF tick.
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("passes deltaMs = 0 on the first frame", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback, true));

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenLastCalledWith(0);
  });

  it("does not run while disabled", () => {
    const callback = vi.fn();
    renderHook(() => useFrameLoop(callback, false));

    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it("stops on disable and resumes on re-enable", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useFrameLoop(callback, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(1); // paused

    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("uses the latest callback without restarting the loop", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }: { cb: (d: number) => void }) => useFrameLoop(cb, true),
      { initialProps: { cb: first as (d: number) => void } },
    );

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ cb: second });
    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("cancels the rAF on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useFrameLoop(callback, true));

    act(() => {
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
    act(() => {
      vi.advanceTimersToNextFrame();
      vi.advanceTimersToNextFrame();
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
