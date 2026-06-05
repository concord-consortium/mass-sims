// @concord-consortium/mass-sims-shared
//
// Public barrel for the shared library. Phase 1 populates this incrementally as components
// and hooks land. See ../../../docs/infrastructure-plan.md §3 for the full intended contract.

// Components
export {
  DataSubsection,
  type DataSubsectionProps,
} from "./components/data-subsection/data-subsection";
export { Section, type SectionProps } from "./components/section/section";
export {
  SimulationFrame,
  type SimulationFrameProps,
} from "./components/simulation-frame/simulation-frame";
export { TrialCard, type TrialCardProps } from "./components/trial-card/trial-card";

// Hooks
export { useCurrentAndPrevious } from "./hooks/use-current-and-previous";
export { useFrameLoop } from "./hooks/use-frame-loop";
export { useInterval } from "./hooks/use-interval";
export {
  type UseModelStateOptions,
  type UseModelStateReturn,
  useModelState,
} from "./hooks/use-model-state";
export { useReloadWarning } from "./hooks/use-reload-warning";
export {
  useStateWithCallback,
  useStateWithCallbackInstant,
  useStateWithCallbackLazy,
} from "./hooks/use-state-with-callback";

// Utils
export {
  resetAll,
  resetSeededRandom,
  restoreSeededRandom,
  type SeededRandom,
  type SeededRandomState,
  saveSeededRandom,
  seededRandom,
} from "./utils/seeded-random";
