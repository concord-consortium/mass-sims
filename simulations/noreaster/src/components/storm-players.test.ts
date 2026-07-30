import { describe, expect, it, vi } from "vitest";
import { createStormPlayer, mulberry32 } from "./storm-players";

describe("mulberry32", () => {
  it("is deterministic for a seed and diverges by seed", () => {
    const a = mulberry32(92653);
    const b = mulberry32(92653);
    const c = mulberry32(58979);
    const seqA = [a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b()];
    const seqC = [c(), c(), c(), c()];
    expect(seqA).toEqual(seqB); // same seed → identical stream (the storm's determinism)
    expect(seqA).not.toEqual(seqC);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("createStormPlayer", () => {
  it("builds the right system per outcome (duration + drift)", () => {
    const strong = createStormPlayer("strong");
    const moderate = createStormPlayer("moderate");
    const weak = createStormPlayer("weakCoastal");
    const humid = createStormPlayer("humidNoStorm");
    expect(strong?.duration).toBe(10);
    expect(strong?.moves).toBe(true); // spiral drifts NE
    expect(moderate?.duration).toBe(7);
    expect(weak?.duration).toBe(5);
    expect(weak?.moves).toBe(true); // band drifts NE
    expect(humid?.duration).toBe(8);
    expect(humid?.moves).toBe(false); // haze is stationary
  });

  it("returns null where there's no cloud (windy / fair)", () => {
    expect(createStormPlayer("windy")).toBeNull();
    expect(createStormPlayer("fair")).toBeNull();
  });

  it("drifts the container NE (ease-out) from start to end across t", () => {
    const p = createStormPlayer("strong");
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.offsetAt(0)).toEqual({ x: -23, y: 41 });
    expect(p.offsetAt(1)).toEqual({ x: 53, y: -61 });
    // Ease-out (1 − (1−t)^1.3): the t=0.5 point is already past the linear midpoint.
    expect(p.offsetAt(0.5).x).toBeGreaterThan((-23 + 53) / 2);
  });

  it("steps + renders the final frame without throwing, for every cloud system", () => {
    // The offscreen buffer's 2D context is null in jsdom, so drawing is a guarded no-op and only the
    // physics (spawn/step/compact) runs. The no-op stub keeps the test valid regardless: if a real 2D
    // context were ever added to the env, `draw`/`composite` would run and just no-op against these.
    const ctx = {
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    for (const outcome of ["strong", "moderate", "weakCoastal", "humidNoStorm"] as const) {
      const p = createStormPlayer(outcome);
      expect(p).not.toBeNull();
      if (!p) continue;
      expect(() => {
        p.step(ctx, 0, 16);
        p.step(ctx, (p.duration * 1000) / 2, 16);
        p.step(ctx, p.duration * 1000, 16);
        p.renderFinal(ctx);
      }).not.toThrow();
    }
  });
});
