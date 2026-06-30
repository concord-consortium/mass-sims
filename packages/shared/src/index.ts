// @concord-consortium/mass-sims-shared
//
// Public barrel for the shared library. Phase 1 populates this incrementally as components
// and hooks land. See ../../../docs/infrastructure-plan.md §3 for the full intended contract.

// Components
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
export {
  resetAll,
  resetSeededRandom,
  restoreSeededRandom,
  type SeededRandom,
  type SeededRandomState,
  saveSeededRandom,
  seededRandom,
} from "./utils/seeded-random";
