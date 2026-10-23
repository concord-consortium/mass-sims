import { useLogEvent } from "@concord-consortium/mass-sims-shared";
import { useStores } from "../stores/root-store";

export type SampleYearsSource = "slider" | "stepper";

/**
 * The one write path for the timeline value, used by both the slider and the stepper, so the store
 * write and its log event can't drift apart. Logs `sample_years_set` only when the value changes.
 */
export function useSetSampleYears() {
  const { ui } = useStores();
  const logEvent = useLogEvent();

  const set = (index: number, source: SampleYearsSource) => {
    const previous = ui.sampleYears;
    ui.setTimelineIndex(index);
    if (ui.sampleYears === previous) return;
    logEvent("sample_years_set", {
      value: ui.sampleYears,
      previous,
      trial: ui.selectedTrialLetter,
      source,
    });
  };

  const step = (dir: -1 | 1, source: SampleYearsSource) => set(ui.timelineIndex + dir, source);

  return { set, step };
}
