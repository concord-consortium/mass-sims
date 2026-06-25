import { TrialCard } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { KeyboardEvent } from "react";
import { TRIAL_LETTERS, type TrialLetter } from "../../model/trials";
import { useStores } from "../../stores/root-store";
import { TrialCardBody, trialAriaLabel } from "./trial-card-body";

import "./trials-panel.scss";

/** The `+ New` card: appends a trial and selects it. A native button (Enter/Space handled natively). */
function NewTrialCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button type="button" className="new-trial-card" aria-label="Add new trial" onClick={onAdd}>
      <span className="new-trial-card-plus" aria-hidden="true">
        +
      </span>
      <span className="new-trial-card-text">New</span>
    </button>
  );
}

/** Shown in place of the `+ New` card once all MAX_TRIALS trials exist. */
function MaxTrialsNotice() {
  return (
    <div className="max-trials-notice" role="status" aria-live="polite">
      Max number of trials reached
    </div>
  );
}

/**
 * The Trials column orchestrator: one shared `<TrialCard>` per trial (with a Bananas-local body),
 * plus a `+ New` card or a "max reached" notice. Selecting a card loads that trial into the
 * Simulation + Data panels. `observer`-wrapped so the card list, selection, and per-card aria-labels
 * track store mutations.
 */
export const TrialsPanel = observer(function TrialsPanel() {
  const store = useStores();
  const selectedLetter = store.ui.selectedTrialLetter;

  const handleAdd = () => {
    // Guard on the return value: defensive against clicking `+ New` as the cap flips (the visual
    // card is also gated on `canAddTrial`, so this normally never returns null).
    const newLetter = store.addTrial();
    if (newLetter) store.ui.selectTrial(newLetter);
  };

  // Roving-tabindex keyboard navigation, delegated to the tablist. Up/Down move focus AND selection
  // to the adjacent card (no wrap); Home/End jump to the first/last. Left/Right are intentionally
  // ignored (vertical orientation, per WAI-ARIA). Acts only when a trial card is focused — not the
  // `+ New` card (its own native button handles Enter/Space).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(".trial-card")) return;
    const letters = store.trialLetters;
    const i = letters.indexOf(selectedLetter);
    let target: number;
    switch (e.key) {
      case "ArrowDown":
        target = Math.min(i + 1, letters.length - 1);
        break;
      case "ArrowUp":
        target = Math.max(i - 1, 0);
        break;
      case "Home":
        target = 0;
        break;
      case "End":
        target = letters.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    const newLetter = letters[target];
    if (newLetter && newLetter !== selectedLetter) store.ui.selectTrial(newLetter);
    // Move focus to the target card's button (focus() works regardless of tabIndex).
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>(".trial-card");
    buttons[target]?.focus();
  };

  return (
    <div
      className="bananas-trials-panel"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Trials"
      onKeyDown={onKeyDown}
    >
      {Array.from(store.trials.entries()).map(([letter, trial]) => {
        const selected = letter === selectedLetter;
        return (
          <TrialCard
            key={letter}
            index={TRIAL_LETTERS.indexOf(letter as TrialLetter)}
            selected={selected}
            resetDisabled={!trial.canReset}
            tabIndex={selected ? 0 : -1}
            role="tab"
            ariaSelected={selected}
            ariaLabel={trialAriaLabel(letter, trial)}
            onSelect={() => store.ui.selectTrial(letter)}
            onReset={() => store.resetTrial(letter)}
          >
            <TrialCardBody trial={trial} />
          </TrialCard>
        );
      })}
      {store.canAddTrial ? <NewTrialCard onAdd={handleAdd} /> : <MaxTrialsNotice />}
    </div>
  );
});
