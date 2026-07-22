import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so the mock fn exists when the hoisted vi.mock factory runs.
const { setHeight } = vi.hoisted(() => ({ setHeight: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({
  setHeight,
}));

import { FRAME_HEIGHT } from "../layout/target-widths";
import { useReportHeight } from "./use-report-height";

describe("useReportHeight", () => {
  beforeEach(() => {
    setHeight.mockReset();
  });

  it("reports the fixed frame height to the host when enabled (embedded)", () => {
    renderHook(() => useReportHeight(true));
    expect(setHeight).toHaveBeenCalledWith(FRAME_HEIGHT);
  });

  it("does not report height when disabled (standalone)", () => {
    renderHook(() => useReportHeight(false));
    expect(setHeight).not.toHaveBeenCalled();
  });

  it("reports once — a rerender with the same enabled value does not re-post", () => {
    const { rerender } = renderHook(({ enabled }) => useReportHeight(enabled), {
      initialProps: { enabled: true },
    });
    rerender({ enabled: true });
    expect(setHeight).toHaveBeenCalledTimes(1);
  });

  it("reports when enabled flips from standalone to embedded", () => {
    const { rerender } = renderHook(({ enabled }) => useReportHeight(enabled), {
      initialProps: { enabled: false },
    });
    expect(setHeight).not.toHaveBeenCalled();
    rerender({ enabled: true });
    expect(setHeight).toHaveBeenCalledWith(FRAME_HEIGHT);
  });

  it("does not throw when lara-interactive-api throws (uninitialized client)", () => {
    setHeight.mockImplementationOnce(() => {
      throw new Error("not initialized");
    });
    expect(() => renderHook(() => useReportHeight(true))).not.toThrow();
  });
});
