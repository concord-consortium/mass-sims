import { type RefObject, useCallback, useEffect, useRef } from "react";
import { createStormPlayer, NOR_SIZE, type StormPlayer } from "../animation/storm-players";
import type { Outcome } from "../model/weather";
import { norDebugFlag } from "../utils/nor-debug";

/**
 * The storm-canvas setup helper: it owns the fixed backing store (no DPR multiplier), builds the
 * per-outcome player, positions the container, and keeps a per-outcome `renderFinal` cache. It does not
 * own a clock — the runner drives the animated frames imperatively via `drawFrame`; the hook itself only
 * paints the static final frame (restore / hydration / reduced motion / post-finalize) via an effect.
 * Returns the imperative draw API the runner calls.
 *
 * `stormOutcome` is the outcome to depict: during a run it's the captured `ui.run.outcome` (the trial's
 * own outcome is still null — deferred); otherwise it's the trial's committed outcome. `null` → no cloud.
 */
export interface StormAnimation {
  /** Draw one animated frame (runner-driven) at `cloudElapsedMs` into the cloud, stepping physics by `dtMs`. */
  drawFrame(cloudElapsedMs: number, dtMs: number): void;
  /** Paint the deterministic final frame + park the container at its end position. */
  drawFinal(): void;
  /** Clear the canvas, re-seed the particle system, and hide the container (run start, or no outcome). */
  clear(): void;
}

/** Diagnostic-only window surface (`__norPerf`): the perf probe reads `renderFinal` first-gen latency here. */
interface StormPerfWindow extends Window {
  __norStormRenderFinalMs?: (outcome: Outcome) => number | null;
}

export function useStormAnimation(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLElement | null>,
  stormOutcome: Outcome | null,
  isRunning: boolean,
): StormAnimation {
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const playerRef = useRef<StormPlayer | null>(null);
  const cacheRef = useRef<Map<Outcome, HTMLCanvasElement>>(new Map());
  // What the canvas currently shows (by animation or by drawFinal). Lets the static-final effect skip a
  // redraw the moment a run finalizes — the animation's actual last frame stays, so there's no jump to
  // the approximate regenerated final frame. `drawFinal` is then only for a genuine restore.
  const paintedRef = useRef<Outcome | null>(null);
  const outcomeRef = useRef(stormOutcome);
  outcomeRef.current = stormOutcome;

  // Size the backing store once — fixed, never DPR-multiplied (NOR_SCALE is the budget).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = NOR_SIZE;
    canvas.height = NOR_SIZE;
    ctxRef.current = canvas.getContext("2d");
  }, [canvasRef]);

  // (Re)build the player when the depicted outcome changes; null for the no-cloud outcomes.
  useEffect(() => {
    playerRef.current = stormOutcome ? createStormPlayer(stormOutcome) : null;
  }, [stormOutcome]);

  // Diagnostic-only (`__norPerf`, set by the perf probe via addInitScript — not URL-reachable): expose a
  // `renderFinal` first-generation timer so the probe can measure that synchronous cost separately from
  // the live loop. Uses a fresh player + canvas so it never touches the live animation.
  useEffect(() => {
    if (!norDebugFlag("__norPerf")) return;
    (window as StormPerfWindow).__norStormRenderFinalMs = (outcome: Outcome) => {
      const player = createStormPlayer(outcome);
      const c = document.createElement("canvas");
      c.width = NOR_SIZE;
      c.height = NOR_SIZE;
      const cctx = c.getContext("2d");
      if (!player || !cctx) return null;
      const t0 = performance.now();
      player.renderFinal(cctx);
      return performance.now() - t0;
    };
    return () => {
      (window as StormPerfWindow).__norStormRenderFinalMs = undefined;
    };
  }, []);

  const positionContainer = useCallback(
    (opacity: number, offset: { x: number; y: number }) => {
      const c = containerRef.current;
      if (!c) return;
      c.style.opacity = String(opacity);
      c.style.transform = `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`;
    },
    [containerRef],
  );

  const clear = useCallback(() => {
    ctxRef.current?.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    // Re-seed the (cached) player so a replay grows from nothing instead of continuing the prior run's
    // particles — the runner calls `clear` at every run start, and `stormOutcome` is unchanged on a replay
    // so the player is not rebuilt. Also undoes any end-state left by a `renderFinal`.
    playerRef.current?.reset();
    const c = containerRef.current;
    if (c) c.style.opacity = "0";
    paintedRef.current = null;
  }, [containerRef]);

  const drawFrame = useCallback(
    (cloudElapsedMs: number, dtMs: number) => {
      const ctx = ctxRef.current;
      const player = playerRef.current;
      if (!ctx || !player) return;
      player.step(ctx, cloudElapsedMs, dtMs);
      const es = cloudElapsedMs / 1000;
      const t = Math.min(es / player.duration, 1);
      // Container fades in over the first second.
      positionContainer(es < 1 ? es : 1, player.offsetAt(player.moves ? t : 0));
      // Mark the canvas as showing this outcome's complete final frame only at the animation's end. The
      // static-final effect then keeps that frame (no jump to the regenerated one) — but a run canceled
      // mid-animation leaves paintedRef unset, so it snaps to the deterministic final frame instead of
      // being left on a partial, mid-drift frame.
      if (t >= 1) paintedRef.current = outcomeRef.current;
    },
    [positionContainer],
  );

  const drawFinal = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || !stormOutcome) return;
    const player = playerRef.current;
    if (!player) {
      // A no-cloud outcome (windy / fair): there's nothing to draw, so CLEAR the canvas and hide the
      // container. Without this, restoring a no-cloud trial would leave the previous trial's storm on the
      // shared canvas (it returns early otherwise).
      ctx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
      if (containerRef.current) containerRef.current.style.opacity = "0";
      paintedRef.current = stormOutcome;
      return;
    }
    // Generate the deterministic final frame once per outcome, then just copy that saved image — avoids
    // re-running the full deterministic sim (several hundred physics steps) on every restore/hydration.
    let cache = cacheRef.current.get(stormOutcome);
    if (!cache) {
      const c = document.createElement("canvas");
      c.width = NOR_SIZE;
      c.height = NOR_SIZE;
      const cctx = c.getContext("2d");
      if (cctx) {
        player.renderFinal(cctx);
        cacheRef.current.set(stormOutcome, c);
        cache = c;
      }
    }
    ctx.clearRect(0, 0, NOR_SIZE, NOR_SIZE);
    if (cache) ctx.drawImage(cache, 0, 0);
    positionContainer(1, player.offsetAt(player.moves ? 1 : 0));
    paintedRef.current = stormOutcome;
  }, [stormOutcome, positionContainer, containerRef]);

  // Static final display for a NON-running outcome (restore / hydration / reduced motion). NOT for the
  // moment a run finalizes: the animation already painted this outcome's real last frame (paintedRef),
  // so we leave it — a regenerated final frame is only ~equal to the animation's, and swapping to it
  // reads as a jump. During a run the runner drives `drawFrame`. With no outcome, clear.
  useEffect(() => {
    if (stormOutcome && !isRunning) {
      if (paintedRef.current !== stormOutcome) drawFinal();
    } else if (!stormOutcome) {
      clear();
    }
  }, [stormOutcome, isRunning, drawFinal, clear]);

  return { drawFrame, drawFinal, clear };
}
