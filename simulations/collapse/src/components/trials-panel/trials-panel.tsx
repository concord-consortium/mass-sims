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
 * The Trials column orchestrator: a single-select `role="listbox"` of the four fixed trial `option`s
 * (one shared `<TrialCard>` each, drawn as tabs that join the Simulation panel), and a single
 * panel-level reset button for the selected trial (outside the listbox — a listbox must not own
 * focusable non-options). There is no `+ New` card: Collapse's four trials are fixed at creation.
 * `observer`-wrapped so the selection and reset state track store mutations.
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
  // `activeTrial` is resettable once it has a recorded output.
  const selectedIndex = Math.max(0, store.trialLetters.indexOf(selectedLetter));
  const selectedOptionLetter = store.trialLetters[selectedIndex] ?? selectedLetter;
  const activeTrial = store.activeTrial;

  // Single funnel for every trial-selection change (card click, keyboard nav) so the no-op skip and
  // the `trial_selected` emit live in exactly one place. `selectTrial` itself stays pure (hydration
  // depends on that).
  const navigateTo = (newLetter: string) => {
    const prev = store.ui.selectedTrialLetter;
    if (newLetter === prev) return;
    logEvent("trial_selected", { trial: newLetter, previous: prev });
    store.ui.selectTrial(newLetter);
  };

  // Roving-tabindex keyboard nav for the cards (one tab stop), driven by the shared hook. Its
  // handlers go on the listbox (which delegates for the cards) — NOT on the panel wrapper, which
  // stays non-interactive. `canAddTrial` is always false, so the ring has no `+ New` member.
  const nav = useTrialsKeyboardNav({
    containerRef: listRef,
    letters: store.trialLetters,
    selectedIndex,
    canAddTrial: store.canAddTrial,
    selectLetter: navigateTo,
  });

  // Reset the selected trial (the only one the panel reset targets). Emit before the reset so the
  // payload reads the trial being reset, then narrate it.
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
              ariaLabel={trialAriaLabel(letter as CollapseTrialLetter)}
              onSelect={() => navigateTo(letter)}
            >
              <TrialCardBody letter={letter as CollapseTrialLetter} />
            </TrialCard>
          );
        })}
      </div>
      {/* Panel-level reset for the selected trial — outside the listbox, positioned over the
          selected card by index via `--selected-index` (see trials-panel.scss). */}
      <TrialResetButton
        letter={selectedOptionLetter}
        disabled={activeTrial.output === null}
        onReset={handleReset}
        tabIndex={nav.resetTabIndex}
        style={{ "--selected-index": selectedIndex } as CSSProperties}
      />
    </div>
  );
});
