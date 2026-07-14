import {
  MAX_TRIALS_DEFAULT,
  MaxTrialsNotice,
  NewTrialCard,
  TRIAL_LETTERS_DEFAULT as TRIAL_LETTERS,
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
import { TrialCardBody, trialAriaLabel } from "./trial-card-body";

// `.new-trial-card` and `.max-trials-notice` are styled here, not by the shared components — those
// ship no SCSS because the `+ New` card is themed per sim (this one tints it from the local theme).
import "./trials-panel.scss";

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
  // The rendered selection, roving tabindex, keyboard nav, and panel reset all key off one clamped
  // fallback. A transiently dangling `selectedLetter` (a malformed hydrate, before the store's
  // normalization fixes it) matches no card; clamping the index to a real trial keeps exactly one
  // option selected and tabbable (never a listbox with no tab stop), positions the reset over that
  // card (cards are fixed-height, so the CSS reads `--selected-index`), and stops reset from
  // narrating or targeting a letter that isn't there. In the normal case these equal the selection.
  const selectedIndex = Math.max(0, store.trialLetters.indexOf(selectedLetter));
  const selectedOptionLetter = store.trialLetters[selectedIndex] ?? selectedLetter;
  const activeTrial = store.activeTrial;

  // Reset the selected trial (the only one the panel reset targets). Emit before the reset so the
  // payload reads the trial being reset, then narrate it.
  const handleReset = () => {
    logEvent("trial_reset", { trial: selectedOptionLetter });
    store.resetTrial(selectedOptionLetter);
    announce(`Trial ${selectedOptionLetter} reset.`);
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

  // Roving-tabindex keyboard nav for the whole column (cards + `+ New` card as one tab stop), driven
  // by the shared hook. Its handlers go on the listbox (which delegates for the cards) AND on the
  // `+ New` card, which lives outside the listbox and so must carry them itself — NOT on the panel
  // wrapper, which stays non-interactive. The returned tabIndexes drive the roving tab stop.
  const nav = useTrialsKeyboardNav({
    containerRef: listRef,
    letters: store.trialLetters,
    selectedIndex,
    canAddTrial: store.canAddTrial,
    selectLetter: navigateTo,
  });

  const handleAdd = () => {
    // Guard on the return value: defensive against clicking `+ New` as the cap flips (the visual
    // card is also gated on `canAddTrial`, so this normally never returns null).
    const newLetter = store.addTrial();
    if (!newLetter) return;
    // `trial_added` before `trial_selected`: a trial was created AND is now being viewed (two
    // distinct actions). `addTrial` doesn't change the selection, so navigateTo's emit fires here.
    logEvent("trial_added", { trial: newLetter });
    navigateTo(newLetter);
    nav.focusAddedTrial();
    // Announce the trials cap when this add was the last one (nothing else narrates in this
    // handler, so no same-event composition is needed — unlike the cross cap in ControlBar).
    if (!store.canAddTrial) announce(`Maximum of ${MAX_TRIALS_DEFAULT} trials reached.`);
  };

  return (
    <div className="bananas-trials-panel" ref={listRef}>
      <div
        className="bananas-trials-listbox"
        role="listbox"
        aria-orientation="vertical"
        aria-label="Trials"
        onKeyDown={nav.onKeyDown}
        onFocus={nav.onFocus}
      >
        {Array.from(store.trials.entries()).map(([letter, trial]) => {
          const selected = letter === selectedOptionLetter;
          return (
            <TrialCard
              key={letter}
              index={TRIAL_LETTERS.indexOf(letter as TrialLetter)}
              selected={selected}
              tabIndex={selected ? nav.selectedCardTabIndex : -1}
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
        letter={selectedOptionLetter}
        disabled={!activeTrial.canReset}
        onReset={handleReset}
        tabIndex={nav.resetTabIndex}
        style={{ "--selected-index": selectedIndex } as CSSProperties}
      />
      {store.canAddTrial ? (
        <NewTrialCard
          onAdd={handleAdd}
          tabIndex={nav.newCardTabIndex}
          onKeyDown={nav.onKeyDown}
          onFocus={nav.onFocus}
        />
      ) : (
        <MaxTrialsNotice />
      )}
    </div>
  );
});
