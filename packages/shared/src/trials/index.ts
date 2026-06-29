// Shared trial-list infrastructure: constants, the UiStore base, the universal multi-trial logic,
// and the saved-state envelope helper. Re-exported from the package root so sims import via
// `import { TRIAL_LETTERS_DEFAULT, addTrial, ... } from "@concord-consortium/mass-sims-shared"`.

export { MAX_TRIALS_DEFAULT, TRIAL_LETTERS_DEFAULT, type TrialLetter } from "./constants";
export {
  toVersionedSavedState,
  type VersionedSavedState,
} from "./saved-state";
export {
  activeTrial,
  addTrial,
  canAddTrial,
  hasAnyProgress,
  type TrialsMap,
  trialLetters,
} from "./stores";
export { UiStore, type UiStoreInstance } from "./ui-store";
