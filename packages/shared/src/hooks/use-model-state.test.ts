import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useModelState } from "./use-model-state";

interface Input {
  bounciness: number;
  gravity: number;
}
interface Output {
  bouncesCounted: number;
  peakHeight: number;
}
interface Transient {
  vy: number;
  y: number;
}

const initial = {
  initialInput: { bounciness: 0.8, gravity: 9.8 } satisfies Input,
  initialOutput: { bouncesCounted: 0, peakHeight: 0 } satisfies Output,
  initialTransient: { vy: 0, y: 100 } satisfies Transient,
};

describe("useModelState", () => {
  it("returns the three initial state shapes", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    expect(result.current.input).toEqual(initial.initialInput);
    expect(result.current.output).toEqual(initial.initialOutput);
    expect(result.current.transient).toEqual(initial.initialTransient);
  });

  it("updates input via setInput and exposes the new value", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setInput({ bounciness: 0.5, gravity: 1.6 }));
    expect(result.current.input).toEqual({ bounciness: 0.5, gravity: 1.6 });
  });

  it("supports partial input updates via setInput's function form", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setInput((prev) => ({ ...prev, gravity: 3.7 })));
    expect(result.current.input).toEqual({ bounciness: 0.8, gravity: 3.7 });
  });

  it("updates transient via setTransient (same semantics)", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setTransient({ vy: -10, y: 50 }));
    expect(result.current.transient).toEqual({ vy: -10, y: 50 });
    act(() => result.current.setTransient((prev) => ({ ...prev, y: prev.y - 5 })));
    expect(result.current.transient).toEqual({ vy: -10, y: 45 });
  });

  it("commits per-trial output via setOutput", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => result.current.setOutput({ bouncesCounted: 3, peakHeight: 120 }));
    expect(result.current.output).toEqual({ bouncesCounted: 3, peakHeight: 120 });
  });

  it("resetTransient restores ONLY transient to its initial value (input and output untouched)", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ bounciness: 0.5, gravity: 1.6 });
      result.current.setTransient({ vy: 0, y: 0 });
      result.current.setOutput({ bouncesCounted: 2, peakHeight: 50 });
    });
    act(() => result.current.resetTransient());
    expect(result.current.transient).toEqual(initial.initialTransient);
    expect(result.current.input).toEqual({ bounciness: 0.5, gravity: 1.6 });
    expect(result.current.output).toEqual({ bouncesCounted: 2, peakHeight: 50 });
  });

  it("resetOutput restores ONLY output to its initial value", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ bounciness: 0.5, gravity: 1.6 });
      result.current.setOutput({ bouncesCounted: 4, peakHeight: 80 });
    });
    act(() => result.current.resetOutput());
    expect(result.current.output).toEqual(initial.initialOutput);
    expect(result.current.input).toEqual({ bounciness: 0.5, gravity: 1.6 });
  });

  it("resetAll restores all three states to their initial values", () => {
    const { result } = renderHook(() => useModelState<Input, Output, Transient>(initial));
    act(() => {
      result.current.setInput({ bounciness: 0.5, gravity: 1.6 });
      result.current.setTransient({ vy: 0, y: 0 });
      result.current.setOutput({ bouncesCounted: 4, peakHeight: 80 });
    });
    act(() => result.current.resetAll());
    expect(result.current.input).toEqual(initial.initialInput);
    expect(result.current.transient).toEqual(initial.initialTransient);
    expect(result.current.output).toEqual(initial.initialOutput);
  });
});
