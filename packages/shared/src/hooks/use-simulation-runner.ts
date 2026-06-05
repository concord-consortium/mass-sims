import { useCallback, useState } from "react";
import { useFrameLoop } from "./use-frame-loop";

export interface UseSimulationRunnerOptions {
  /**
   * Called on every animation frame while running, AND once per `step()` invocation.
   * Receives the time delta in milliseconds since the previous frame (0 for step calls
   * unless the caller asks for a synthetic delta — see `stepDeltaMs`).
   */
  onStep: (deltaMs: number) => void;
  /** Synthetic delta used when `step()` is invoked. Defaults to 16 ms (~60 fps frame). */
  stepDeltaMs?: number;
}

export interface UseSimulationRunnerReturn {
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  step: () => void;
}

/**
 * Play / pause / step lifecycle on top of `useFrameLoop`. Sims pass an `onStep` callback
 * that advances the model. `play()` starts the rAF loop; `pause()` stops it; `step()`
 * invokes the callback once without changing the running state (useful for advancing the
 * model frame by frame while paused).
 *
 * See docs/infrastructure-plan.md §3 for the contract.
 */
export function useSimulationRunner({
  onStep,
  stepDeltaMs = 16,
}: UseSimulationRunnerOptions): UseSimulationRunnerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  useFrameLoop(onStep, isPlaying);
  const play = useCallback(() => setIsPlaying(true), []);
  const pause = useCallback(() => setIsPlaying(false), []);
  const step = useCallback(() => {
    onStep(stepDeltaMs);
  }, [onStep, stepDeltaMs]);
  return { isPlaying, play, pause, step };
}
