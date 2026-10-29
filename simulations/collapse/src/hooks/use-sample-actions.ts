import { useAnnounce, useLogEvent } from "@concord-consortium/mass-sims-shared";
import { formatWhole, isCollapsed } from "../model/erosion";
import type { SortKey } from "../model/types";
import { useStores } from "../stores/root-store";

/** Each column's name in the sort announcement: its heading without the unit. */
export const SORT_NAMES: Record<SortKey, string> = {
  years: "Years before collapse",
  rate: "Erosion rate",
  roof: "Rock above cave",
};

const samplesWord = (n: number) => (n === 1 ? "sample" : "samples");

/**
 * The one write path for the data table's interactions, used by the Sample button and the table,
 * so each store write, its log event, and its announcement can't drift apart. Every action works
 * on the selected trial.
 */
export function useSampleActions() {
  const store = useStores();
  const { ui } = store;
  const logEvent = useLogEvent();
  const announce = useAnnounce();

  const takeSample = () => {
    const trial = ui.selectedTrialLetter;
    const { id, years, rate, roof } = store.takeSample();
    const sampleCount = store.activeTrial.sampleCount;
    logEvent("sample_taken", {
      trial,
      id,
      years,
      rate,
      roof,
      collapsed: isCollapsed(roof),
      sampleCount,
    });
    announce(
      `Sampled ${formatWhole(years)} years before collapse. Erosion rate ${formatWhole(rate)} ` +
        `millimeters per 1,000 years, rock above the cave ${formatWhole(roof)} millimeters. ` +
        `Trial ${trial} now has ${sampleCount} ${samplesWord(sampleCount)}.`,
    );
  };

  /** Selects the sample `id`. Selecting the selected sample, or `null`, deselects. */
  const selectSample = (id: number | null) => {
    const trial = ui.selectedTrialLetter;
    const current = store.selectedSample;
    const target = id === null || id === current?.id ? null : store.activeTrial.sampleById(id);
    if (target === undefined) return;
    if (target === null) {
      if (!current) return;
      ui.selectSample(trial, null);
      logEvent("sample_selected", {
        trial,
        id: current.id,
        years: current.years,
        selected: false,
      });
      announce("Deselected. Select a row to see its cross section.");
      return;
    }
    ui.selectSample(trial, target.id);
    logEvent("sample_selected", { trial, id: target.id, years: target.years, selected: true });
    announce(`Selected the sample at ${formatWhole(target.years)} years before collapse.`);
  };

  const deleteSample = (id: number) => {
    const trial = ui.selectedTrialLetter;
    const sample = store.activeTrial.sampleById(id);
    if (!sample) return;
    store.deleteSample(trial, id);
    const remaining = store.activeTrial.sampleCount;
    logEvent("sample_deleted", { trial, id, years: sample.years, remaining });
    announce(`Row deleted. ${remaining} ${samplesWord(remaining)} left.`);
  };

  const cycleSort = (key: SortKey) => {
    ui.cycleSort(key);
    const { key: sorted, direction } = ui.sort;
    logEvent("table_sorted", {
      trial: ui.selectedTrialLetter,
      key,
      direction: sorted === null ? "none" : direction === 1 ? "ascending" : "descending",
    });
    announce(
      sorted === null
        ? "Not sorted. Back to the order you took the samples in."
        : `Sorted by ${SORT_NAMES[sorted]}, ${direction === 1 ? "lowest" : "highest"} first.`,
    );
  };

  return { takeSample, selectSample, deleteSample, cycleSort };
}
