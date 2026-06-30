// Typed test data for the Bananas e2e suite.
//
// SINGLE SOURCE OF TRUTH via re-export: rather than duplicating the sim's constants, this module
// RE-EXPORTS them straight from simulations/bananas/src/. Catalogs (parent varieties, trial
// letters) grow with the sim, so specs pick up new entries automatically with no edits here. The
// two source modules imported below are pure (no React / vite-svg / scss imports), so importing
// them into the Playwright-run suite is safe.
//
// Behavior-defining CAP values (MAX_CROSSES, MAX_TRIALS) are also imported — but because an import
// alone can't catch a silent change to the value, the Bananas smoke spec pairs this with a tiny
// "cap values match expected literals" assertion. That gives single-source-of-truth AND regression
// detection: an intentional cap change updates both the constant and the assertion; an accidental
// one trips the assertion.
//
// Parent ids are kebab-cased (the model's keys); PARENT_LABELS are what the <Select> dropdown
// displays — Playwright clicks options by their visible label text, not by id.

import { PARENT_GENOTYPES, type ParentId } from "../../simulations/bananas/src/model/genetics";

export {
  MAX_CROSSES,
  OFFSPRING_MAX,
  OFFSPRING_MIN,
  PARENT_GENOTYPES,
  PARENT_LABELS,
  type ParentId,
} from "../../simulations/bananas/src/model/genetics";
export {
  MAX_TRIALS,
  TRIAL_LETTERS,
  type TrialLetter,
} from "../../simulations/bananas/src/model/trials";

/** All parent ids, derived from the genetics catalog so new varieties appear automatically. */
export const PARENT_IDS = Object.keys(PARENT_GENOTYPES) as ParentId[];

/**
 * A convenient default parent pair for tests that just need "some cross." PARENT_IDS[0] is
 * wild-w1 (Rr), so wild-w1 × wild-w1 yields a mix of resistant and susceptible offspring —
 * useful when a test wants both healthy and infected plants to appear (e.g. with fungus on).
 */
export const BASELINE_CROSS = { p1: PARENT_IDS[0], p2: PARENT_IDS[0] } as const;
