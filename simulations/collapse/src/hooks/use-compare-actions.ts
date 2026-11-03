import { useAnnounce, useLogEvent } from "@concord-consortium/mass-sims-shared";
import { formatWhole } from "../model/erosion";
import { useStores } from "../stores/root-store";
import { COLLAPSE_TRIAL_LETTERS } from "../trial-conditions";

/**
 * The one write path for the Compare Trials view, so each store write, its log event, and its
 * announcement can't drift apart. `trial` in each event is the active trial, as in the main data
 * table's events.
 */
export function useCompareActions() {
  const store = useStores();
  const { ui } = store;
  const logEvent = useLogEvent();
  const announce = useAnnounce();

  /** Opens with the selected row's year pinned, or no pin without a selection. */
  const openCompare = () => {
    if (ui.compareOpen) return;
    ui.openCompare(store.selectedSample?.years ?? null);
    logEvent("compare_opened", { trial: ui.selectedTrialLetter, pinnedYears: ui.pinnedYear });
    announce("Comparing all four trials.");
  };

  const closeCompare = (source: "close" | "escape") => {
    if (!ui.compareOpen) return;
    ui.closeCompare();
    logEvent("compare_closed", { trial: ui.selectedTrialLetter, source });
    announce("Comparison closed.");
  };

  const togglePin = (years: number) => {
    ui.togglePin(years);
    const pinned = ui.pinnedYear !== null;
    const trials = store.trialsSampledAt(years);
    logEvent("compare_year_pinned", { trial: ui.selectedTrialLetter, years, pinned, trials });
    if (!pinned) {
      announce("Pin cleared.");
      return;
    }
    // Which trials lack the year is the useful part: it says where the comparison is missing data.
    const missing = COLLAPSE_TRIAL_LETTERS.filter((letter) => !trials.includes(letter));
    const where =
      missing.length === 0
        ? "Sampled in all four trials."
        : `Sampled in ${trials.length === 1 ? "trial" : "trials"} ${trials.join(", ")}; ` +
          `not in ${missing.join(", ")}.`;
    announce(`${formatWhole(years)} years before collapse pinned. ${where}`);
  };

  return { openCompare, closeCompare, togglePin };
}
