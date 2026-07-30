import { useState } from "react";
import type { Outcome } from "../model/weather";

/**
 * Whether the weather scene should fade in (vs. appear instantly) this render. Not inferable from `outcome`
 * alone — the same value arrives via Run, hydration, or trial-switch — so it keys off the `.volatile`
 * `runCompletedToken` that `finalizeRun` bumps once per completed run: fade only when the token advanced AND
 * the outcome changed, so replay / hydration / trial-switch / Reset stay instant.
 */
export function useJustFinalized(outcome: Outcome | null, runCompletedToken: number): boolean {
  // Adjust-state-during-render (not a render-phase ref mutation) so the "just finalized" edge is
  // StrictMode/concurrent-safe and lands on the SAME commit as `data-scene` — the CSS fade only arms when
  // opacity and `transition` change together.
  const [seen, setSeen] = useState({ token: runCompletedToken, outcome, animate: false });
  if (seen.token !== runCompletedToken || seen.outcome !== outcome) {
    const freshFinalization =
      runCompletedToken !== seen.token && outcome !== null && outcome !== seen.outcome;
    setSeen({ token: runCompletedToken, outcome, animate: freshFinalization });
  }
  // Latched until the token/outcome next changes; don't reset it — flipping `data-animate` mid-fade sets
  // `transition:none` and cancels the in-flight fade.
  return seen.animate;
}
