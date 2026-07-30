import {
  useDocumentHidden,
  useFrameLoop,
  useReducedMotion,
} from "@concord-consortium/mass-sims-shared";
import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";
import type { NoreasterRun } from "../stores/ui-store";
import { MAX_FRAME_MS, TOTAL_DUR_S } from "./run-timing";
import type { PillTransition } from "./use-pill-phase";

/**
 * Drives the Weather-Outcome pill's progress fill, synced to the run animation in the Sim panel.
 *
 * It does NOT read the runner's clock — it re-derives it. A second `useFrameLoop`, gated on the SAME
 * condition as `useStormRun` (`run != null && !reducedMotion && !hidden`) and accumulating with the SAME
 * `MAX_FRAME_MS` clamp, consumes the same animation frames; both start on the same commit (both observe
 * `ui.run`), so the fill stays within ~1 frame of the animation. Completion is authoritative anyway: when
 * the run finalizes, `run` clears and the pill resolves regardless of exactly where this loop reached.
 *
 * The fill is off-screen-left at width 0 and sweeps its rounded right cap across the pill; `left` and
 * `width` are set together each frame from the same measured height so the off-screen cap can't desync.
 *
 * Takes the run DESCRIPTOR (not the trial's outcome): `activeTrial.outcome` is null through a first run, so
 * both the duration (`run.outcome`) and the reset identity (`run.runId`) come from `ui.run`. `transition`
 * (from `usePillPhase`) is what lets the fill tell a real completion (fade out, keep width) from a
 * cancellation (snap hidden) — a bare `run` false-edge can't.
 */
export function useProgressBar(
  fillRef: RefObject<HTMLElement | null>,
  pillRef: RefObject<HTMLElement | null>,
  run: NoreasterRun | null,
  transition: PillTransition,
): void {
  const reducedMotion = useReducedMotion();
  const hidden = useDocumentHidden();
  const elapsedRef = useRef(0);
  const runId = run?.runId ?? null;

  // Reset to the off-screen start before paint on each new run — a layout effect (not a plain one) avoids
  // a one-frame flash of the prior bar when opacity is restored. Keyed on `runId`, so only a new run
  // resets. Also where a completed fill's width resets; the completion path below only fades opacity.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    const pill = pillRef.current;
    if (!fill || !pill || runId == null) return; // no run → completion/cancel handled below, not here
    elapsedRef.current = 0;
    const h = pill.offsetHeight;
    fill.style.transition = "none";
    fill.style.opacity = "1";
    fill.style.left = `${-h}px`;
    fill.style.width = `${h}px`;
  }, [runId, fillRef, pillRef]);

  // Resolve the fill when a run ends: fade out on a real completion (keeping the completed width under the
  // fade), snap hidden on a cancellation / reset / steady-idle. `"start"` is a no-op here — the reset above
  // and the loop own the running state.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (transition === "complete") {
      fill.style.transition = reducedMotion ? "none" : "opacity 0.6s ease";
      fill.style.opacity = "0";
    } else if (transition === "instant" && !run) {
      fill.style.transition = "none";
      fill.style.opacity = "0";
      fill.style.left = "0px";
      fill.style.width = "0px";
    }
  }, [transition, run, reducedMotion, fillRef]);

  const tick = useCallback(
    (deltaMs: number) => {
      const fill = fillRef.current;
      const pill = pillRef.current;
      if (!fill || !pill || !run) return;
      elapsedRef.current += Math.min(deltaMs, MAX_FRAME_MS);
      const totalMs = TOTAL_DUR_S[run.outcome] * 1000;
      const p = Math.min(elapsedRef.current / totalMs, 1);
      // Measure each frame → resize is free. `left` + `width` share the height so the clipped left cap
      // stays pinned off-screen while the right cap sweeps 0 → 100%.
      const h = pill.offsetHeight;
      const w = pill.offsetWidth;
      fill.style.left = `${-h}px`;
      fill.style.width = `${h + p * w}px`;
    },
    [fillRef, pillRef, run],
  );

  useFrameLoop(tick, run != null && !reducedMotion && !hidden);
}
