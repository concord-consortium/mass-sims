import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  useStateWithCallback,
  useStateWithCallbackInstant,
  useStateWithCallbackLazy,
} from "./use-state-with-callback";

describe("useStateWithCallback", () => {
  it("fires the callback once on mount and again after every state update", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useStateWithCallback<number>(0, callback));

    expect(result.current[0]).toBe(0);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith(0);

    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith(1);
  });

  it("supports functional updates", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useStateWithCallback<number>(0, callback));

    act(() => {
      result.current[1]((n) => n + 5);
    });
    expect(result.current[0]).toBe(5);
    expect(callback).toHaveBeenLastCalledWith(5);
  });
});

describe("useStateWithCallbackInstant", () => {
  it("fires the callback once on mount and again after every state update", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useStateWithCallbackInstant<number>(0, callback));

    expect(result.current[0]).toBe(0);
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      result.current[1](1);
    });
    expect(result.current[0]).toBe(1);
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("useStateWithCallbackLazy", () => {
  it("does not call the callback on mount", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useStateWithCallbackLazy(0));

    expect(result.current[0]).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the per-setter callback once after the next commit, then clears it", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { result } = renderHook(() => useStateWithCallbackLazy(0));

    act(() => {
      result.current[1](1, cb1);
    });
    expect(result.current[0]).toBe(1);
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb1).toHaveBeenCalledWith(1);

    // A subsequent set with a different callback fires only the new callback.
    act(() => {
      result.current[1](2, cb2);
    });
    expect(cb1).toHaveBeenCalledTimes(1); // still 1
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledWith(2);
  });

  it("supports a set call without a callback", () => {
    const { result } = renderHook(() => useStateWithCallbackLazy(0));
    act(() => {
      result.current[1](7);
    });
    expect(result.current[0]).toBe(7);
  });
});
