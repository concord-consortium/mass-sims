import {
  TRIAL_LETTERS_DEFAULT,
  TrialCard,
  type TrialLetter,
  useLogEvent,
} from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { KeyboardEvent } from "react";
import AddIcon from "../../assets/icons/add.svg?react";
import { useStores } from "../../stores/root-store";
import { TrialCardBody, trialAriaLabel } from "./trial-card-body";

import "./trials-panel.scss";

/** The `+ New` card: appends a trial and selects it. A native button (Enter/Space handled natively). */
function NewTrialCard({ onAdd }: { onAdd: () => void }) {
  return (
    <button type="button" className="new-trial-card" aria-label="Add new trial" onClick={onAdd}>
      <AddIcon className="new-trial-card-icon" aria-hidden="true" />
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
 * The Trials column orchestrator: one shared `<TrialCard>` per trial, plus a `+ New` card or a
 * "max reached" notice. Selecting a card loads that trial into the Simulation + Data panels.
 * `observer`-wrapped so the card list, selection, per-card stats, and aria-labels track store
 * mutations.
 *
 * This is a "tab-like" selector, not strict WAI-ARIA tabs: the `role="tablist"` container also holds
 * the `+ New` card / notice, and the cards use `role="tab"` without an `aria-controls`/tabpanel link
 * (the Simulation panel is the implicit panel the active card controls).
 *
 * Under review: a planned accessibility follow-up will likely move this to listbox/option semantics —
 * see docs/trial-selector-a11y-followup.md.
 */
export const TrialsPanel = observer(function TrialsPanel() {
  const store = useStores();
  const logEvent = useLogEvent();
  const selectedLetter = store.ui.selectedTrialLetter;

  // Single funnel for every trial-selection change (card click, keyboard nav, post-add auto-select)
  // so the no-op skip and the `trial_selected` emit live in exactly one place. `selectTrial` itself
  // stays pure (hydration + quiet add-then-select callers depend on that).
  const navigateTo = (newLetter: string) => {
    const prev = store.ui.selectedTrialLetter;
    if (newLetter === prev) return;
    logEvent("trial_selected", { trial: newLetter, previous: prev });
    store.ui.selectTrial(newLetter);
  };

  const handleAdd = () => {
    // Guard on the return value: defensive against clicking `+ New` as the cap flips (the visual
    // card is also gated on `canAddTrial`, so this normally never returns null). `addTrial` doesn't
    // change the selection, so navigateTo's emit fires here.
    const newLetter = store.addTrial();
    if (!newLetter) return;
    // `trial_added` before `trial_selected`: a trial was created AND is now being viewed (two
    // distinct actions).
    logEvent("trial_added", { trial: newLetter });
    navigateTo(newLetter);
  };

  // Roving-tabindex keyboard navigation, delegated to the tablist. Up/Down move focus AND selection
  // to the adjacent card (no wrap); Home/End jump to first/last. Left/Right are intentionally ignored
  // (vertical orientation, per WAI-ARIA). Acts only when a trial card is focused — not the `+ New`
  // card (its own native button handles Enter/Space).
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
    if (newLetter) navigateTo(newLetter);
    // Move focus to the target card's button (focus() works regardless of tabIndex).
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>(".trial-card");
    buttons[target]?.focus();
  };

  return (
    <div
      className="starter-trials-panel"
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
            index={TRIAL_LETTERS_DEFAULT.indexOf(letter as TrialLetter)}
            selected={selected}
            resetDisabled={trial.output === null}
            tabIndex={selected ? 0 : -1}
            role="tab"
            ariaSelected={selected}
            ariaLabel={trialAriaLabel(letter, trial)}
            onSelect={() => navigateTo(letter)}
            onReset={() => {
              // Uses the iteration `letter` (the acted-on card), not the active letter. Emit before
              // the reset so the payload reads the trial being reset.
              logEvent("trial_reset", { trial: letter });
              store.resetTrial(letter);
            }}
          >
            <TrialCardBody trial={trial} />
          </TrialCard>
        );
      })}
      {store.canAddTrial ? <NewTrialCard onAdd={handleAdd} /> : <MaxTrialsNotice />}
    </div>
  );
});
