import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInterval } from "./use-interval";

describe("useInterval", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("invokes the callback on every interval tick", () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, 100));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(callback).toHaveBeenCalledTimes(4);
  });

  it("uses the latest callback without restarting the timer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ cb }: { cb: () => void }) => useInterval(cb, 100), {
      initialProps: { cb: first },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ cb: second });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(first).toHaveBeenCalledTimes(1); // still 1 — not called again
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("pauses when delay becomes null and resumes when it becomes a number", () => {
    const callback = vi.fn();
    const { rerender } = renderHook(
      ({ delay }: { delay: number | null }) => useInterval(callback, delay),
      { initialProps: { delay: 100 as number | null } },
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    rerender({ delay: null });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1); // paused

    rerender({ delay: 50 });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(callback).toHaveBeenCalledTimes(4); // 1 from before + 3 new ticks
  });

  it("clears the interval on unmount", () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useInterval(callback, 100));

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1); // no further calls after unmount
  });
});
