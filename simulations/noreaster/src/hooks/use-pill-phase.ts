import { useState } from "react";
import type { Outcome } from "../model/weather";

/**
 * The Weather-Outcome pill's visual state during and around a run. `phase` is the label/fill face to show;
 * `transition` is the SINGLE provenance signal both the pill CSS and the progress bar read to arm (or not
 * arm) their crossfades — so the label and the fill can never disagree about whether a run started,
 * completed, or was canceled.
 *
 * - `"empty"` — no outcome, no run: the "–" placeholder.
 * - `"simulating"` — a first run in progress: the "Simulating…" overlay + a sweeping bar.
 * - `"simulating-replay"` — a replay in progress: the committed outcome label kept (white outline) + a bar.
 * - `"filled"` — a committed outcome, no run: the steady banner.
 */
export type PillPhase = "empty" | "simulating" | "simulating-replay" | "filled";

/**
 * - `"start"` — a run just began (arm the run-start crossfade).
 * - `"complete"` — a run just finalized, INCLUDING a replay (arm the completion crossfade / fade-out).
 * - `"instant"` — steady state, hydration, trial switch, or a cancellation (Reset / switch mid-run): no
 *   animation.
 */
export type PillTransition = "start" | "complete" | "instant";

export interface PillPhaseInput {
  /** A run is animating for the shown trial (`ui.run?.trial === selected`). */
  runningHere: boolean;
  /** The in-progress run is a replay (`ui.run?.replay`). Only read when `runningHere`. */
  replay: boolean;
  /** The active trial's committed outcome (`activeTrial.outcome`) — null through a first run. */
  outcome: Outcome | null;
  /** `ui.runId` — the monotonic run counter; only `armRun` advances it (→ `"start"`). */
  runId: number;
  /** `ui.runCompletedToken` — only `finalizeRun` advances it, on every completion incl. replay (→ `"complete"`). */
  runCompletedToken: number;
}

/**
 * Derive `{ phase, transition }` for the pill. `phase` is pure from the current inputs; `transition` is a
 * latched edge computed with the adjust-state-during-render pattern of `useJustFinalized` (StrictMode- and
 * concurrent-safe) so it lands on the same commit as `phase`. It keys off the store's own counters:
 * `runId` advancing means a run began (`"start"`); `runCompletedToken` advancing means one finalized
 * (`"complete"`, which takes precedence over the run ending). Anything else is `"instant"` — a trial
 * switch, or a cancellation (Reset / switch mid-run). The `runningHere` edge is watched alongside the
 * counters because a FIRST run's cancellation leaves both counters untouched AND the outcome null (it's
 * deferred), so that true→false edge is the only signal that such a run ended.
 */
export function usePillPhase({
  runningHere,
  replay,
  outcome,
  runId,
  runCompletedToken,
}: PillPhaseInput): { phase: PillPhase; transition: PillTransition } {
  const phase: PillPhase = runningHere
    ? replay
      ? "simulating-replay"
      : "simulating"
    : outcome
      ? "filled"
      : "empty";

  // Latch the transition on the render where a counter, the shown outcome, or the running edge changes;
  // hold it otherwise, so an in-flight crossfade isn't cut short by an unrelated re-render.
  // Adjust-state-during-render (not a ref mutation) keeps the edge on the committed render even under
  // StrictMode's double invoke.
  const [seen, setSeen] = useState({
    runId,
    token: runCompletedToken,
    outcome,
    running: runningHere,
    transition: "instant" as PillTransition,
  });
  if (
    seen.runId !== runId ||
    seen.token !== runCompletedToken ||
    seen.outcome !== outcome ||
    seen.running !== runningHere
  ) {
    // `runId` advance → start; else `token` advance → complete (takes precedence over the run ending);
    // else instant (trial switch, or a cancellation — a `running` true→false edge with no counter move).
    const transition: PillTransition =
      runId !== seen.runId ? "start" : runCompletedToken !== seen.token ? "complete" : "instant";
    setSeen({ runId, token: runCompletedToken, outcome, running: runningHere, transition });
  }

  return { phase, transition: seen.transition };
}
