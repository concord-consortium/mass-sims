import { useLogEvent } from "@concord-consortium/mass-sims-shared";
import { useStores } from "../stores/root-store";

export type SampleYearsSource = "slider" | "stepper";

/**
 * The write path for student changes to the active trial's timeline value, used by both the slider
 * and the stepper, so the store write and its log event can't drift apart. Logs `sample_years_set`
 * only when the value changes. A trial's reset also moves the value, with no log event.
 *
 * A drag is one change, as for the shared `Slider`: it moves the value with `setWithoutLog`, then
 * calls `logChange` once when it ends. `logChange` takes the trial the drag started on, because the
 * active trial can change during a drag.
 */
export function useSetSampleYears() {
  const store = useStores();
  const logEvent = useLogEvent();

  const logChange = (
    previous: number,
    source: SampleYearsSource,
    letter = store.ui.selectedTrialLetter,
  ) => {
    const trial = store.trials.get(letter);
    if (!trial || trial.sampleYears === previous) return;
    logEvent("sample_years_set", {
      value: trial.sampleYears,
      previous,
      trial: letter,
      source,
    });
  };

  const set = (index: number, source: SampleYearsSource) => {
    const previous = store.activeTrial.sampleYears;
    store.activeTrial.setTimelineIndex(index);
    logChange(previous, source);
  };

  const step = (dir: -1 | 1, source: SampleYearsSource) =>
    set(store.activeTrial.timelineIndex + dir, source);

  const setWithoutLog = (index: number) => store.activeTrial.setTimelineIndex(index);

  return { set, step, setWithoutLog, logChange };
}
