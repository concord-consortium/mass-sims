// Test data for the `collapse` sim. Keep any imported sim modules pure: no React, SVG, or SCSS.

export {
  COLLAPSE_TRIAL_LETTERS as TRIAL_LETTERS,
  type CollapseTrialLetter as TrialLetter,
} from "../../simulations/collapse/src/trial-conditions";

import { COLLAPSE_TRIAL_LETTERS } from "../../simulations/collapse/src/trial-conditions";

export const MAX_TRIALS = COLLAPSE_TRIAL_LETTERS.length;
