// Typed test data for the Starter e2e suite.
//
// SINGLE SOURCE OF TRUTH via re-export: the trial-list constants come from the shared package
// (packages/shared/src/trials/constants), which both Starter and Bananas build on — so specs can't
// drift from the sim. That module is pure (no React / vite-svg / scss), so importing it into the
// Playwright-run suite is safe.
//
// MAX_TRIALS is behavior-defining; an import alone can't catch a silent change to the value, so the
// Starter smoke spec pairs this with a "cap values match expected literals" assertion. That gives
// single-source-of-truth AND regression detection: an intentional cap change updates both the
// constant and the assertion; an accidental one trips the assertion.
export {
  MAX_TRIALS_DEFAULT as MAX_TRIALS,
  TRIAL_LETTERS_DEFAULT as TRIAL_LETTERS,
  type TrialLetter,
} from "../../packages/shared/src/trials/constants";
