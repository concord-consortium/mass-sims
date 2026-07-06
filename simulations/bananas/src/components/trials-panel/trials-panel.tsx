import {
  MAX_TRIALS_DEFAULT,
  TRIAL_LETTERS_DEFAULT as TRIAL_LETTERS,
  TrialCard,
  type TrialLetter,
  TrialResetButton,
  useAnnounce,
  useLogEvent,
  useScrollSelectedTrialIntoView,
} from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import type { CSSProperties, KeyboardEvent } from "react";
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
  return <div className="max-trials-notice">Max number of trials reached</div>;
}

/**
 * The Trials column orchestrator: a single-select `role="listbox"` of trial `option`s (one shared
 * `<TrialCard>` each, with a Bananas-local body), plus a `+ New` card or a "max reached" notice as
 * siblings *outside* the listbox, and a single panel-level reset button for the selected trial
 * (also outside the listbox — a listbox must not own focusable non-options).
 * `observer`-wrapped so the card list, selection, and per-card aria-labels track store mutations.
 */
export const TrialsPanel = observer(function TrialsPanel() {
  const store = useStores();
  const logEvent = useLogEvent();
  const announce = useAnnounce();
  const selectedLetter = store.ui.selectedTrialLetter;
  const listRef = useScrollSelectedTrialIntoView<HTMLDivElement>(selectedLetter);
  // The panel reset is positioned over the selected card by index (cards are fixed-height); the CSS
  // reads `--selected-index`. Clamp the index and derive `resetLetter` from it so a transiently
  // dangling `selectedLetter` (a malformed hydrate, before the store's normalization fixes it)
  // can't produce a nonsensical `-1` position or narrate/reset a letter that isn't there; both fall
  // back to the first trial, matching `activeTrial`. In the normal case these equal the selection.
  const selectedIndex = Math.max(0, store.trialLetters.indexOf(selectedLetter));
  const resetLetter = store.trialLetters[selectedIndex] ?? selectedLetter;
  const activeTrial = store.activeTrial;

  // Reset the selected trial (the only one the panel reset targets). Emit before the reset so the
  // payload reads the trial being reset, then narrate it.
  const handleReset = () => {
    logEvent("trial_reset", { trial: resetLetter });
    store.resetTrial(resetLetter);
    announce(`Trial ${resetLetter} reset.`);
  };

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
    // card is also gated on `canAddTrial`, so this normally never returns null).
    const newLetter = store.addTrial();
    if (!newLetter) return;
    // `trial_added` before `trial_selected`: a trial was created AND is now being viewed (two
    // distinct actions). `addTrial` doesn't change the selection, so navigateTo's emit fires here.
    logEvent("trial_added", { trial: newLetter });
    navigateTo(newLetter);
    // Announce the trials cap when this add was the last one (nothing else narrates in this
    // handler, so no same-event composition is needed — unlike the cross cap in ControlBar).
    if (!store.canAddTrial) announce(`Maximum of ${MAX_TRIALS_DEFAULT} trials reached.`);
  };

  // Roving-tabindex keyboard navigation, delegated to the listbox. Up/Down move focus AND selection
  // to the adjacent option and WRAP (last→first, first→last); Home/End jump to the first/last.
  // Left/Right are intentionally ignored (vertical orientation, per WAI-ARIA). Acts only when a
  // trial card is focused — the `+ New` card is outside the listbox and handles Enter/Space natively.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest(".trial-card")) return;
    const letters = store.trialLetters;
    const i = letters.indexOf(selectedLetter);
    let target: number;
    switch (e.key) {
      case "ArrowDown":
        target = (i + 1) % letters.length;
        break;
      case "ArrowUp":
        target = (i - 1 + letters.length) % letters.length;
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
    // Move focus to the target card's button (focus() works regardless of tabIndex). Suppress the
    // browser's default focus-scroll (preventScroll) so it doesn't instantly jump an off-screen card
    // into view before useScrollSelectedTrialIntoView's smooth scroll runs — otherwise keyboard nav
    // shows a jump instead of the same smooth glide as a mouse selection.
    const buttons = e.currentTarget.querySelectorAll<HTMLButtonElement>(".trial-card");
    buttons[target]?.focus({ preventScroll: true });
  };

  return (
    <div className="bananas-trials-panel" ref={listRef}>
      <div
        className="bananas-trials-listbox"
        role="listbox"
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
              tabIndex={selected ? 0 : -1}
              ariaLabel={trialAriaLabel(letter, trial)}
              onSelect={() => navigateTo(letter)}
            >
              <TrialCardBody trial={trial} />
            </TrialCard>
          );
        })}
      </div>
      {/* Panel-level reset for the selected trial — outside the listbox, positioned over the
          selected card by index via `--selected-index` (see trials-panel.scss). */}
      <TrialResetButton
        letter={resetLetter}
        disabled={!activeTrial.canReset}
        onReset={handleReset}
        style={{ "--selected-index": selectedIndex } as CSSProperties}
      />
      {store.canAddTrial ? <NewTrialCard onAdd={handleAdd} /> : <MaxTrialsNotice />}
    </div>
  );
});
