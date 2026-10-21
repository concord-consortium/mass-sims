// Test data for the `collapse` sim, scaffolded from starter-testdata.ts by `yarn new-sim`.
// Collapse has exactly four fixed trials, so it uses its own letter list rather than the shared
// trial-list defaults (keep any imported sim modules pure — no React / vite-svg / scss).

export {
  COLLAPSE_TRIAL_LETTERS as TRIAL_LETTERS,
  type CollapseTrialLetter as TrialLetter,
} from "../../simulations/collapse/src/trial-conditions";

import { COLLAPSE_TRIAL_LETTERS } from "../../simulations/collapse/src/trial-conditions";

export const MAX_TRIALS = COLLAPSE_TRIAL_LETTERS.length;
