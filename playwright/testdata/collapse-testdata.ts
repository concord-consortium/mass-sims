// Test data for the `collapse` sim, scaffolded from starter-testdata.ts by `yarn new-sim`.
// It re-exports the shared trial-list constants every sim builds on; add this sim's own
// catalogs/fixtures as it grows (keep any imported sim modules pure — no React / vite-svg / scss).

export {
  MAX_TRIALS_DEFAULT as MAX_TRIALS,
  TRIAL_LETTERS_DEFAULT as TRIAL_LETTERS,
  type TrialLetter,
} from "../../packages/shared/src/trials/constants";
