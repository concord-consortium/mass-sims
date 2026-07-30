import {
  prefersReducedMotion,
  useAnnounce,
  useFrameLoop,
  useLogEvent,
} from "@concord-consortium/mass-sims-shared";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { Outcome } from "../model/weather";
import { useStores } from "../stores/root-store";
import {
  convergedArrows,
  convergenceFade,
  convergenceRotation,
  convergenceTarget,
} from "./converge";
import { norDebugFlag } from "./nor-debug";
import { finalNarration, STAGED_NARRATION, startNarration } from "./run-narration";
import type { StormAnimation } from "./use-storm-animation";

/**
 * The run controller: drives the deferred running phase's clock and commits the outcome when it elapses.
 * It observes `ui.run` (so it must be called from an `observer` — the map stage), captures that run's
 * `runId`, and accumulates a single elapsed clock over the shared `useFrameLoop` from which every layer's
 * progress derives. When elapsed reaches the per-outcome `totalDur`, it finalizes — committing the
 * captured outcome and emitting the run's analytics + completion narration.
 *
 * Layers are driven off the clock imperatively (no per-frame React state):
 * - Arrow convergence (0–2 s): the two selected arrows tween into the storm start-center and fade out.
 * - The storm canvas (from 1.5 s).
 *
 * Every scheduled effect closes over the captured `runId`, so a stale finalize from a canceled or
 * superseded run is dropped by `finalizeRun`'s id guard.
 */

/**
 * Total run duration per outcome, in seconds — the finalize time, when the outcome commits. For the four
 * cloud outcomes it is the 1.5 s arrow-converge pre-delay plus the cloud's own duration; `windy`/`fair`
 * have no cloud and finish on a ~3 s timeout.
 */
const TOTAL_DUR_S: Record<Outcome, number> = {
  strong: 11.5,
  moderate: 8.5,
  weakCoastal: 6.5,
  humidNoStorm: 9.5,
  windy: 3,
  fair: 3,
};

/** Arrow convergence duration (ms). */
const CONVERGE_MS = 2000;

/** The cloud starts 1.5 s into the run (arrows converge first, then the storm spins up). */
const CLOUD_START_MS = 1500;

/** Clamp per-frame dt so a long stall can't overshoot the finalize deadline (or a resume jump it). */
const MAX_FRAME_MS = 100;

/** Refs the map stage hands the runner so it can drive the overlays imperatively. */
export interface StormRunRefs {
  /** The `.nor-map` overlay frame — the coordinate basis for convergence. */
  frame: RefObject<HTMLElement | null>;
  /** The four pathway arrow elements, keyed by arrow number. */
  arrows: RefObject<Record<number, HTMLElement | null>>;
}

/** A converging arrow's measured tween: the top-left delta from its static spot to the storm center. */
interface Converge {
  nums: number[];
  deltas: Record<number, { x: number; y: number }>;
}

const NO_CONVERGE: Converge = { nums: [], deltas: {} };

export function useStormRun(
  frameRef?: StormRunRefs["frame"],
  arrowsRef?: StormRunRefs["arrows"],
  anim?: StormAnimation,
): void {
  const store = useStores();
  const logEvent = useLogEvent();
  const announce = useAnnounce();

  // Observed here (the caller is an `observer`), so begin/finalize/cancel re-run this hook.
  const run = store.ui.run;
  const runId = run?.runId ?? null;
  const outcome = run?.outcome ?? null;

  // Initial snapshots; the subscriptions below keep them current for a mid-session change.
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  // Diagnostic-only (`__norPerf`, set by the perf probe via addInitScript — not URL-reachable): hold the
  // cloud at peak and suppress auto-finalize so the probe samples worst-case sustained frame cost.
  const [perfHold] = useState(() => norDebugFlag("__norPerf"));

  const elapsedRef = useRef(0);
  const convergeRef = useRef<Converge>(NO_CONVERGE);
  const narratedRef = useRef(0); // index of the next staged narration line to speak

  // Commit the run + fire its analytics/narration, guarded by the captured `runId` so a stale call is a
  // no-op. `finalizeRun` returns the committed run (or null when the id no longer matches).
  const finalize = useCallback(() => {
    if (runId == null) return;
    const done = store.finalizeRun(runId);
    if (!done) return;
    logEvent("simulation_run", { trial: done.trial, replay: done.replay, outcome: done.outcome });
    announce(finalNarration(done.outcome));
  }, [store, runId, logEvent, announce]);

  // Reset the clock + staged-narration index, hide the storm (until the cloud spins up at 1.5 s), and
  // speak the run-start "…converging" line on each new run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on `runId` — a new run resets state; `announce` / `anim` / `store` are stable.
  useEffect(() => {
    elapsedRef.current = 0;
    narratedRef.current = 0;
    if (runId == null) return;
    anim?.clear();
    const active = store.ui.run;
    const setup = active ? store.trials.get(active.trial)?.setup : null;
    if (setup) announce(startNarration(setup, active?.replay ?? false));
  }, [runId]);

  // Measure the convergence geometry on a new run, and clear the arrows' inline tween styles when it
  // ends. Skipped under reduced motion (the arrows jump straight to the final state on finalize) and when
  // the map refs are absent (timing-only callers). Cleanup is flash-safe: at finalize the arrows are
  // already at opacity 0, and the static CSS state is applied in the re-render this cleanup follows.
  useEffect(() => {
    const arrows = arrowsRef?.current;
    const frameEl = frameRef?.current;
    if (runId == null || reducedMotion || !arrows || !frameEl) {
      convergeRef.current = NO_CONVERGE;
      return;
    }
    const active = store.ui.run;
    const trial = active ? store.trials.get(active.trial) : null;
    const nums = trial ? convergedArrows(trial.landPathway, trial.oceanPathway) : [];
    const frameRect = frameEl.getBoundingClientRect();
    const frame = { width: frameRect.width, height: frameRect.height };
    const deltas: Record<number, { x: number; y: number }> = {};
    for (const num of nums) {
      const el = arrows[num];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const target = convergenceTarget(num, frame);
      deltas[num] = {
        x: target.x - (r.left - frameRect.left),
        y: target.y - (r.top - frameRect.top),
      };
    }
    convergeRef.current = { nums, deltas };
    return () => {
      for (const num of nums) {
        const el = arrows[num];
        if (!el) continue;
        el.style.transform = "";
        el.style.opacity = "";
        el.style.filter = "";
      }
      convergeRef.current = NO_CONVERGE;
    };
  }, [runId, reducedMotion, frameRef, arrowsRef, store]);

  // Live reduced-motion subscription (the shared snapshot util isn't reactive). Guarded for jsdom.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Reduced motion (initial, or an OS toggle to it mid-run): collapse to the final state at once.
  useEffect(() => {
    if (runId != null && reducedMotion) finalize();
  }, [runId, reducedMotion, finalize]);

  // Pause the clock while the tab is hidden — folded into `enabled` below. `useFrameLoop` re-inits its
  // frame clock on re-enable, so resuming doesn't jump the elapsed.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const enabled = runId != null && !reducedMotion && !hidden;
  const totalMs = outcome ? TOTAL_DUR_S[outcome] * 1000 : 0;

  const tick = useCallback(
    (deltaMs: number) => {
      // One clamped frame delta drives both the clock and the physics, so the cloud can't advance out of
      // step with the run clock on a stall.
      const dt = Math.min(deltaMs, MAX_FRAME_MS);
      elapsedRef.current += dt;
      const elapsed = elapsedRef.current;

      // Arrow convergence (0–2 s): tween each selected arrow's top-left toward the storm center, rotate,
      // and fade out. Written to the elements' inline styles — no React state.
      const arrows = arrowsRef?.current;
      if (arrows) {
        const { nums, deltas } = convergeRef.current;
        const tc = Math.min(elapsed / CONVERGE_MS, 1);
        const fade = convergenceFade(tc);
        for (const num of nums) {
          const el = arrows[num];
          const d = deltas[num];
          if (!el || !d) continue;
          const rot = convergenceRotation(num) * tc;
          el.style.transform = `translate(${d.x * tc}px, ${d.y * tc}px) rotate(${rot}deg)`;
          el.style.opacity = String(fade);
          el.style.filter =
            fade > 0 ? `drop-shadow(0 1px 3px rgba(0,0,0,${(0.35 * fade).toFixed(3)}))` : "none";
        }
      }

      // Staged narration: speak each mid-run line as the clock crosses its time (on the runner's clock,
      // so it pauses with the tab — reduced-motion runs finalize before this and never reach here).
      if (outcome) {
        const staged = STAGED_NARRATION[outcome];
        while (narratedRef.current < staged.length && elapsed >= staged[narratedRef.current].atMs) {
          announce(staged[narratedRef.current].text);
          narratedRef.current += 1;
        }
      }

      // Storm cloud (from 1.5 s): the runner steps the player and positions/opacity the container. Under
      // the diagnostic hold, pin the cloud at peak (t=1) so the probe samples sustained worst-case load.
      const cloudElapsed = perfHold ? 1e9 : elapsed - CLOUD_START_MS;
      if (cloudElapsed >= 0) anim?.drawFrame(cloudElapsed, dt);

      if (!perfHold && elapsed >= totalMs) finalize();
    },
    [totalMs, finalize, arrowsRef, anim, perfHold, outcome, announce],
  );

  useFrameLoop(tick, enabled);
}
