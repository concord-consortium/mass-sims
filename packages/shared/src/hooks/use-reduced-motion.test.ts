import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./use-reduced-motion";

/** A controllable `matchMedia` stub: reports `matches` and captures the `change` listener so a test can fire it. */
function mockMatchMedia(matches: boolean) {
  let handler: (() => void) | null = null;
  const mql = {
    matches,
    addEventListener: (_: string, h: () => void) => {
      handler = h;
    },
    removeEventListener: () => {
      handler = null;
    },
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return {
    change(next: boolean) {
      mql.matches = next;
      handler?.();
    },
  };
}

describe("useReducedMotion", () => {
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
    vi.restoreAllMocks();
  });

  it("seeds from the current value and updates when the OS setting changes mid-session", () => {
    const mm = mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => mm.change(true));
    expect(result.current).toBe(true);
  });

  it("defaults to false when matchMedia is absent (jsdom/SSR)", () => {
    // @ts-expect-error simulate an environment without matchMedia
    window.matchMedia = undefined;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
