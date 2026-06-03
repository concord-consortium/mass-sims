import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useCurrentAndPrevious } from "./use-current-and-previous";

describe("useCurrentAndPrevious", () => {
  it("returns the initial value with undefined previous on first render", () => {
    const { result } = renderHook(({ v }: { v: number }) => useCurrentAndPrevious(v), {
      initialProps: { v: 1 },
    });
    expect(result.current).toEqual([1, undefined]);
  });

  it("tracks the previous value across re-renders", () => {
    const { result, rerender } = renderHook(({ v }: { v: number }) => useCurrentAndPrevious(v), {
      initialProps: { v: 1 },
    });

    rerender({ v: 2 });
    expect(result.current).toEqual([2, 1]);

    rerender({ v: 3 });
    expect(result.current).toEqual([3, 2]);

    rerender({ v: 3 }); // same value, previous still updates to match
    expect(result.current).toEqual([3, 3]);
  });

  it("handles non-primitive values", () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const { result, rerender } = renderHook(
      ({ v }: { v: { id: number } }) => useCurrentAndPrevious(v),
      { initialProps: { v: a } },
    );
    expect(result.current).toEqual([a, undefined]);

    rerender({ v: b });
    expect(result.current).toEqual([b, a]);
  });
});
