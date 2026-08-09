import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Outcome } from "../model/weather";
import { useStormAnimation } from "./use-storm-animation";

// jsdom has no 2D canvas context (test-setup stubs it to null). Install a recording mock so the hook's
// canvas reconciliation actually runs — the container's inline `opacity`/`transform` are the observable
// seam these tests assert against.
let ctx: {
  clearRect: ReturnType<typeof vi.fn>;
  drawImage: ReturnType<typeof vi.fn>;
  [k: string]: unknown;
};
let realGetContext: unknown;

beforeEach(() => {
  ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: "",
    filter: "",
    globalAlpha: 1,
  };
  realGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ctx,
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext =
    realGetContext as typeof HTMLCanvasElement.prototype.getContext;
});

function refs() {
  return {
    canvasRef: { current: document.createElement("canvas") },
    containerRef: { current: document.createElement("span") },
  };
}

describe("useStormAnimation — canvas reconciliation", () => {
  it("clears the leftover storm + hides the container when restoring a no-cloud outcome", () => {
    const { canvasRef, containerRef } = refs();
    const { rerender } = renderHook(
      ({ outcome }: { outcome: Outcome | null }) =>
        useStormAnimation(canvasRef, containerRef, outcome, false),
      { initialProps: { outcome: "strong" as Outcome | null } },
    );
    // A cloud outcome painted its final frame → the container is shown.
    expect(containerRef.current.style.opacity).toBe("1");
    const clearsBefore = ctx.clearRect.mock.calls.length;

    // Restoring a NO-cloud outcome (no player) must clear the canvas + hide the container — otherwise the
    // previous trial's storm stays painted on the shared canvas.
    rerender({ outcome: "windy" });
    expect(containerRef.current.style.opacity).toBe("0");
    expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(clearsBefore);
  });

  it("snaps to the final frame when a run is canceled mid-animation (not left partial)", () => {
    const { canvasRef, containerRef } = refs();
    const { result, rerender } = renderHook(
      ({ outcome, running }: { outcome: Outcome; running: boolean }) =>
        useStormAnimation(canvasRef, containerRef, outcome, running),
      { initialProps: { outcome: "strong", running: true } },
    );
    // A mid-animation frame (strong: 2 s of 10 s → t = 0.2) drifts the container to a partial position and
    // does NOT mark the frame complete.
    act(() => result.current.drawFrame(2000, 16));
    expect(containerRef.current.style.transform).not.toContain("translate(53px, -61px)");

    // Cancel: the run ends (running → false) with the SAME committed outcome. Because the mid frame wasn't
    // marked complete, the effect snaps the container to its END drift (53, -61) — proof `drawFinal` ran
    // rather than leaving the partial frame.
    rerender({ outcome: "strong", running: false });
    expect(containerRef.current.style.transform).toContain("translate(53px, -61px)");
  });
});
