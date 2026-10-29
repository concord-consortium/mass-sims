import {
  TRIAL_LETTERS_DEFAULT,
  TrialCard,
  type TrialLetter,
  TrialResetButton,
  useAnnounce,
  useLogEvent,
  useScrollSelectedTrialIntoView,
  useTrialsKeyboardNav,
} from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { CSSProperties } from "react";
import { useStores } from "../../stores/root-store";
import type { CollapseTrialLetter } from "../../trial-conditions";
import { TrialCardBody, trialAriaLabel } from "./trial-card-body";

import "./trials-panel.scss";

/**
 * The Trials column: a single-select listbox of the four fixed trials (shared `<TrialCard>`s drawn
 * as tabs joined to the Simulation panel), plus one reset button for the selected trial. The reset
 * is outside the listbox because a listbox must not contain focusable non-options.
 */
export const TrialsPanel = observer(function TrialsPanel() {
  const store = useStores();
  const logEvent = useLogEvent();
  const announce = useAnnounce();
  const selectedLetter = store.ui.selectedTrialLetter;
  const listRef = useScrollSelectedTrialIntoView<HTMLDivElement>(selectedLetter);
  // Defensive: if `selectedLetter` ever names no trial, fall back to the first card, so exactly one
  // card is selected and tabbable and the reset targets a real trial.
  const selectedIndex = Math.max(0, store.trialLetters.indexOf(selectedLetter));
  const selectedOptionLetter = store.trialLetters[selectedIndex] ?? selectedLetter;
  const activeTrial = store.activeTrial;

  // Every user selection goes through here, so the no-op skip and the `trial_selected` log live in
  // one place.
  const navigateTo = (newLetter: string) => {
    const prev = store.ui.selectedTrialLetter;
    if (newLetter === prev) return;
    logEvent("trial_selected", { trial: newLetter, previous: prev });
    store.ui.selectTrial(newLetter);
  };

  // The handlers go on the listbox, which delegates for the cards, not on the panel wrapper.
  const nav = useTrialsKeyboardNav({
    containerRef: listRef,
    letters: store.trialLetters,
    selectedIndex,
    canAddTrial: store.canAddTrial,
    selectLetter: navigateTo,
  });

  // Log before resetting so the payload names the trial being reset.
  const handleReset = () => {
    logEvent("trial_reset", { trial: selectedOptionLetter });
    store.resetTrial(selectedOptionLetter);
    announce(`Trial ${selectedOptionLetter} reset.`);
  };

  return (
    <div className="collapse-trials-panel" ref={listRef}>
      <div
        className="collapse-trials-listbox"
        role="listbox"
        aria-orientation="vertical"
        aria-label="Trials"
        onKeyDown={nav.onKeyDown}
        onFocus={nav.onFocus}
      >
        {Array.from(store.trials.keys()).map((letter) => {
          const selected = letter === selectedOptionLetter;
          return (
            <TrialCard
              key={letter}
              index={TRIAL_LETTERS_DEFAULT.indexOf(letter as TrialLetter)}
              selected={selected}
              tabIndex={selected ? nav.selectedCardTabIndex : -1}
              ariaLabel={trialAriaLabel(
                letter as CollapseTrialLetter,
                store.trials.get(letter)?.sampleCount ?? 0,
              )}
              onSelect={() => navigateTo(letter)}
            >
              <TrialCardBody letter={letter as CollapseTrialLetter} />
            </TrialCard>
          );
        })}
      </div>
      {/* Positioned over the selected card by `--selected-index` (see trials-panel.scss). */}
      <TrialResetButton
        letter={selectedOptionLetter}
        disabled={!activeTrial.hasSamples}
        onReset={handleReset}
        tabIndex={nav.resetTabIndex}
        style={{ "--selected-index": selectedIndex } as CSSProperties}
      />
    </div>
  );
});
