import { resetSeededRandom, seededRandom } from "@concord-consortium/mass-sims-shared";
import type { SimInput, SimOutput, SimTransient, Walker } from "./types";

const SAMPLE_EVERY = 10;

export function initialTransient(input: SimInput): SimTransient {
  return {
    frame: 0,
    walkers: Array.from({ length: input.walkerCount }, () => ({ x: 0, y: 0 })),
    avgDistanceSeries: [],
  };
}

export function stepWalkers(prev: SimTransient, input: SimInput): SimTransient {
  // Per-frame key (trial seed + frame) so frames draw independently. `seededRandom` caches a
  // stateful PRNG per key, so reset it first — that makes a given (seed, frame) reproduce the
  // same draws, keeping the model deterministic across re-runs.
  const key = `${input.seed}:${prev.frame}`;
  resetSeededRandom(key);
  const rng = seededRandom(key);
  const walkers: Walker[] = prev.walkers.map((w) => ({
    x: w.x + (rng() * 2 - 1) * input.stepSize,
    y: w.y + (rng() * 2 - 1) * input.stepSize,
  }));
  const frame = prev.frame + 1;
  const series = [...prev.avgDistanceSeries];
  if (frame % SAMPLE_EVERY === 0) {
    series.push(summarizeDistances(walkers).avgDistance);
  }
  return { frame, walkers, avgDistanceSeries: series };
}

export function summarizeDistances(walkers: readonly Walker[]): {
  avgDistance: number;
  stdDevDistance: number;
} {
  if (walkers.length === 0) return { avgDistance: 0, stdDevDistance: 0 };
  const distances = walkers.map((w) => Math.hypot(w.x, w.y));
  const avgDistance = distances.reduce((s, d) => s + d, 0) / distances.length;
  // Sample standard deviation (n - 1 denominator).
  const variance =
    walkers.length > 1
      ? distances.reduce((s, d) => s + (d - avgDistance) ** 2, 0) / (distances.length - 1)
      : 0;
  return { avgDistance, stdDevDistance: Math.sqrt(variance) };
}

export function finalizeTrial(transient: SimTransient): SimOutput {
  const { avgDistance, stdDevDistance } = summarizeDistances(transient.walkers);
  return { avgDistance, stdDevDistance, avgDistanceSeries: [...transient.avgDistanceSeries] };
}
