import { describe, expect, it } from "vitest";
import { finalizeTrial, initialTransient, stepWalkers, summarizeDistances } from "./random-walk";
import type { SimInput, SimTransient } from "./types";

const baseInput: SimInput = {
  walkerCount: 50,
  stepSize: 1,
  framesPerTrial: 100,
  seed: "test-seed",
};

describe("random-walk model", () => {
  describe("initialTransient", () => {
    it("places all walkers at the origin", () => {
      const t = initialTransient(baseInput);
      expect(t.walkers).toHaveLength(baseInput.walkerCount);
      expect(t.walkers.every((w) => w.x === 0 && w.y === 0)).toBe(true);
      expect(t.frame).toBe(0);
      expect(t.avgDistanceSeries).toEqual([]);
    });
  });

  describe("stepWalkers", () => {
    it("advances every walker by at most stepSize per axis (deterministic seed)", () => {
      const t = initialTransient(baseInput);
      const next = stepWalkers(t, baseInput);
      expect(next.frame).toBe(1);
      for (const w of next.walkers) {
        expect(Math.abs(w.x)).toBeLessThanOrEqual(baseInput.stepSize);
        expect(Math.abs(w.y)).toBeLessThanOrEqual(baseInput.stepSize);
      }
    });

    it("is deterministic across runs with the same seed", () => {
      const a = stepWalkers(initialTransient(baseInput), baseInput);
      const b = stepWalkers(initialTransient(baseInput), baseInput);
      expect(a.walkers).toEqual(b.walkers);
    });

    it("samples avg-distance into avgDistanceSeries every 10 frames", () => {
      let t = initialTransient(baseInput);
      for (let i = 0; i < 30; i++) t = stepWalkers(t, baseInput);
      // Frame 30 → expect 3 samples (frames 10, 20, 30).
      expect(t.avgDistanceSeries.length).toBe(3);
      expect(t.avgDistanceSeries.every((v) => typeof v === "number" && v >= 0)).toBe(true);
    });
  });

  describe("summarizeDistances", () => {
    it("computes mean and stddev from walker positions", () => {
      const positions = [
        { x: 3, y: 4 }, // distance 5
        { x: 0, y: 0 }, // distance 0
        { x: 6, y: 8 }, // distance 10
      ];
      const summary = summarizeDistances(positions);
      expect(summary.avgDistance).toBeCloseTo(5, 5);
      // Sample stddev of [5, 0, 10] is 5.
      expect(summary.stdDevDistance).toBeCloseTo(5, 5);
    });
  });

  describe("finalizeTrial", () => {
    it("returns a SimOutput summarizing the transient at trial end", () => {
      let t: SimTransient = initialTransient(baseInput);
      for (let i = 0; i < baseInput.framesPerTrial; i++) t = stepWalkers(t, baseInput);
      const output = finalizeTrial(t);
      expect(output.avgDistance).toBeGreaterThanOrEqual(0);
      expect(output.stdDevDistance).toBeGreaterThanOrEqual(0);
      expect(output.avgDistanceSeries.length).toBeGreaterThan(0);
    });
  });
});
