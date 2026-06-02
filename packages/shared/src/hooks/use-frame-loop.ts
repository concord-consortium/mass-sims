import { useEffect, useRef } from "react";

/**
 * Runs `callback` on every browser animation frame while `enabled` is true.
 *
 * The callback receives the time delta (ms) since the previous frame — useful for
 * frame-rate-aware simulation stepping (a model that moves "5 units/second" can multiply by
 * `deltaMs / 1000` instead of assuming a fixed framerate). On the first frame the delta is 0.
 *
 * - Updating `callback` does NOT restart the loop; the latest callback is captured via a ref.
 * - When `enabled` flips to `false`, the rAF schedule is canceled.
 * - On unmount, the rAF schedule is canceled.
 *
 * This is the rAF wrapper the infrastructure plan §5 calls for. Higher-level lifecycle
 * (play/pause/step) is intentionally kept out of this hook — it will live in
 * useSimulationRunner (Phase 2), which will compose this.
 */
export function useFrameLoop(callback: (deltaMs: number) => void, enabled: boolean): void {
  const callbackRef = useRef(callback);

  // Always invoke the latest callback, without restarting the loop when callback identity changes.
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    if (!enabled) return;

    let frameId = 0;
    let lastTime: number | null = null;

    const tick = (timestamp: number) => {
      const deltaMs = lastTime === null ? 0 : timestamp - lastTime;
      lastTime = timestamp;
      callbackRef.current(deltaMs);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [enabled]);
}
