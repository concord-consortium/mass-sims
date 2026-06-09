import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` is hoisted above the module body, so the mock fn must be created via
// `vi.hoisted` to exist when the factory runs (a plain top-level `const` would be
// referenced before initialization).
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  log,
}));

import { useLogEvent } from "./use-log-event";

describe("useLogEvent", () => {
  beforeEach(() => {
    log.mockReset();
    // Default: gtag not present.
    (globalThis as { gtag?: unknown }).gtag = undefined;
  });
  afterEach(() => {
    (globalThis as { gtag?: unknown }).gtag = undefined;
  });

  it("returns a stable function reference across rerenders", () => {
    const { result, rerender } = renderHook(() => useLogEvent());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("forwards a valid event to lara-interactive-api log()", () => {
    const { result } = renderHook(() => useLogEvent());
    result.current("play_pressed", { trial: "A" });
    expect(log).toHaveBeenCalledWith("play_pressed", { trial: "A" });
  });

  it("forwards a valid event to window.gtag when present", () => {
    const gtag = vi.fn();
    (globalThis as { gtag?: typeof gtag }).gtag = gtag;
    const { result } = renderHook(() => useLogEvent());
    result.current("play_pressed", { trial: "A" });
    expect(gtag).toHaveBeenCalledWith("event", "play_pressed", { trial: "A" });
  });

  it("does NOT throw when gtag is absent (standalone, GA disabled)", () => {
    const { result } = renderHook(() => useLogEvent());
    expect(() => result.current("play_pressed")).not.toThrow();
  });

  it("throws on a non-snake_case event name in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    expect(() => result.current("PlayPressed")).toThrow(/snake_case/i);
    expect(() => result.current("play-pressed")).toThrow(/snake_case/i);
    expect(() => result.current("play pressed")).toThrow(/snake_case/i);
  });

  it("throws on an event name longer than 40 chars in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    const tooLong = `a_${"x".repeat(40)}`;
    expect(() => result.current(tooLong)).toThrow(/40 char/);
  });

  it("throws on more than 25 param keys in dev", () => {
    const { result } = renderHook(() => useLogEvent());
    const params: Record<string, number> = {};
    for (let i = 0; i < 26; i++) params[`p${i}`] = i;
    expect(() => result.current("evt", params)).toThrow(/25 param/);
  });

  it("calls both transports independently — log() still fires when gtag is absent", () => {
    const { result } = renderHook(() => useLogEvent());
    result.current("trial_started");
    expect(log).toHaveBeenCalled();
  });
});
