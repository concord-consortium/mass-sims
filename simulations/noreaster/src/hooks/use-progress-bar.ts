import {
  useDocumentHidden,
  useFrameLoop,
  useReducedMotion,
} from "@concord-consortium/mass-sims-shared";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { MAX_FRAME_MS, TOTAL_DUR_S } from "../animation/run-timing";
import type { NoreasterRun } from "../stores/ui-store";
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
 * The fill is off-screen-left at width 0 and sweeps its rounded right cap across the pill. Pill dimensions
 * are cached (measured at run start + on resize) so each frame only writes `left`/`width` — never reads
 * layout, which would force a synchronous reflow every frame for the run's duration.
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
  const dimsRef = useRef({ h: 0, w: 0 });
  const runId = run?.runId ?? null;

  const measure = useCallback(() => {
    const pill = pillRef.current;
    if (pill) dimsRef.current = { h: pill.offsetHeight, w: pill.offsetWidth };
  }, [pillRef]);

  // Cache the pill's dimensions rather than reading them per frame (each read would force a synchronous
  // layout, since the loop's own `width` write dirties layout every frame). Measure on mount and on
  // resize; the reset effect below re-measures at each run start. Guarded for jsdom, which has no
  // `ResizeObserver`. Observing the pill (not the fill) can't self-trigger: the fill is absolutely
  // positioned, so its width changes don't resize the pill.
  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return;
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(pill);
    return () => observer.disconnect();
  }, [pillRef, measure]);

  // Reset to the off-screen start before paint on each new run — a layout effect (not a plain one) avoids
  // a one-frame flash of the prior bar when opacity is restored. Keyed on `runId`, so only a new run
  // resets. Also where a completed fill's width resets; the completion path below only fades opacity.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    const pill = pillRef.current;
    if (!fill || !pill || runId == null) return; // no run → completion/cancel handled below, not here
    elapsedRef.current = 0;
    measure(); // fresh dims for this run
    const { h } = dimsRef.current;
    fill.style.transition = "none";
    fill.style.opacity = "1";
    fill.style.left = `${-h}px`;
    fill.style.width = `${h}px`;
  }, [runId, fillRef, pillRef, measure]);

  // Resolve the fill when a run ends: fade out on a real completion (keeping the completed width under the
  // fade), else snap hidden whenever no run is active (cancellation / reset / steady-idle). During a run
  // (`run != null`) this is a no-op — the reset above and the loop own the sweep.
  useLayoutEffect(() => {
    const fill = fillRef.current;
    if (!fill) return;
    if (transition === "complete") {
      fill.style.transition = reducedMotion ? "none" : "opacity 0.6s ease";
      fill.style.opacity = "0";
    } else if (!run) {
      fill.style.transition = "none";
      fill.style.opacity = "0";
      fill.style.left = "0px";
      fill.style.width = "0px";
    }
  }, [transition, run, reducedMotion, fillRef]);

  const tick = useCallback(
    (deltaMs: number) => {
      const fill = fillRef.current;
      if (!fill || !run) return;
      elapsedRef.current += Math.min(deltaMs, MAX_FRAME_MS);
      const totalMs = TOTAL_DUR_S[run.outcome] * 1000;
      const p = Math.min(elapsedRef.current / totalMs, 1);
      // Cached dims (run start + resize) — no per-frame layout read. `left` + `width` share the height so
      // the clipped left cap stays pinned off-screen while the right cap sweeps 0 → 100%.
      const { h, w } = dimsRef.current;
      fill.style.left = `${-h}px`;
      fill.style.width = `${h + p * w}px`;
    },
    [fillRef, run],
  );

  useFrameLoop(tick, run != null && !reducedMotion && !hidden);
}
