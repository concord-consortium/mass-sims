// @concord-consortium/mass-sims-shared
//
// Public barrel for the shared library — the single entry point every sim imports from.
// See ../../../docs/infrastructure-plan.md §3 for the full API contract.

// Components
export {
  type AnnounceFn,
  Announcer,
  type AnnouncerProps,
  useAnnounce,
} from "./components/announcer/announcer";
export { Button, type ButtonProps } from "./components/button/button";
export { Checkbox, type CheckboxProps } from "./components/checkbox/checkbox";
export {
  DataSubsection,
  type DataSubsectionProps,
} from "./components/data-subsection/data-subsection";
export { Histogram, type HistogramProps } from "./components/histogram/histogram";
export { LineChart, type LineChartProps } from "./components/line-chart/line-chart";
export {
  NumberField,
  type NumberFieldProps,
} from "./components/number-field/number-field";
export { Section, type SectionProps } from "./components/section/section";
export {
  Select,
  type SelectOption,
  type SelectProps,
} from "./components/select/select";
export {
  SimulationFrame,
  type SimulationFrameProps,
} from "./components/simulation-frame/simulation-frame";
export { Slider, type SliderProps } from "./components/slider/slider";
export { Switch, type SwitchProps } from "./components/switch/switch";
export { TrialCard, type TrialCardProps } from "./components/trial-card/trial-card";
export {
  TrialResetButton,
  type TrialResetButtonProps,
} from "./components/trial-reset-button/trial-reset-button";

// Hooks
export { useCurrentAndPrevious } from "./hooks/use-current-and-previous";
export { useFrameLoop } from "./hooks/use-frame-loop";
export { useInterval } from "./hooks/use-interval";
export { type LogEvent, useLogEvent } from "./hooks/use-log-event";
export {
  type UseModelStateOptions,
  type UseModelStateReturn,
  useModelState,
} from "./hooks/use-model-state";
export { useReloadWarning } from "./hooks/use-reload-warning";
export { useScrollFocusRing } from "./hooks/use-scroll-focus-ring";
export { useScrollSelectedTrialIntoView } from "./hooks/use-scroll-selected-trial-into-view";
export {
  type UseSimulationRunnerOptions,
  type UseSimulationRunnerReturn,
  useSimulationRunner,
} from "./hooks/use-simulation-runner";
export {
  useStateWithCallback,
  useStateWithCallbackInstant,
  useStateWithCallbackLazy,
} from "./hooks/use-state-with-callback";
export {
  type TrialsKeyboardNav,
  type UseTrialsKeyboardNavOptions,
  useTrialsKeyboardNav,
} from "./hooks/use-trials-keyboard-nav";

// Trial-list infrastructure
export {
  activeTrial,
  addTrial,
  canAddTrial,
  hasAnyProgress,
  MAX_TRIALS_DEFAULT,
  TRIAL_LETTERS_DEFAULT,
  type TrialLetter,
  type TrialsMap,
  toVersionedSavedState,
  trialLetters,
  UiStore,
  type UiStoreInstance,
  type VersionedSavedState,
} from "./trials";

// Utils
export { inIframe } from "./utils/embedding";
export {
  prefersReducedMotion,
  smoothScrollIntoView,
} from "./utils/reduced-motion";
export {
  resetAll,
  resetSeededRandom,
  restoreSeededRandom,
  type SeededRandom,
  type SeededRandomState,
  saveSeededRandom,
  seededRandom,
} from "./utils/seeded-random";
