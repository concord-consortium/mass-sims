import type { FocusEvent, KeyboardEvent } from "react";
import AddIcon from "../../assets/add-icon.svg?react";

export interface NewTrialCardProps {
  onAdd: () => void;
  tabIndex: number;
  /** From `useTrialsKeyboardNav`. Required: this card sits OUTSIDE the listbox, so it can't inherit
   *  the listbox's delegated handler — it must carry the nav handlers itself. */
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  onFocus: (e: FocusEvent<HTMLElement>) => void;
}

/**
 * The `+ New` card that appends a trial: a native `<button>` (Enter/Space activate natively), named
 * `"Add new trial"`. Rendered by each sim's TrialsPanel as a sibling *outside* the trials listbox —
 * a `listbox` must not own focusable non-options — while still sharing the column's single roving
 * tab stop with the trial cards (see `useTrialsKeyboardNav`, and docs/accessibility.md).
 *
 * Shared rather than per-sim on purpose: `useTrialsKeyboardNav` finds this card by its
 * `.new-trial-card` class, so owning the class here (as `<TrialCard>` owns `.trial-card` and
 * `<TrialResetButton>` owns `.reset-button`) keeps a sim from silently renaming it out from under
 * the hook.
 *
 * **Styling is deliberately left to the consumer.** Unlike the other shared components this ships no
 * SCSS: the card is themed per sim, so each sim's `trials-panel.scss` styles `.new-trial-card` / `-icon` / `-text`.
 */
export function NewTrialCard({ onAdd, tabIndex, onKeyDown, onFocus }: NewTrialCardProps) {
  return (
    <button
      type="button"
      className="new-trial-card"
      aria-label="Add new trial"
      tabIndex={tabIndex}
      onClick={onAdd}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    >
      <AddIcon className="new-trial-card-icon" aria-hidden="true" />
      <span className="new-trial-card-text">New</span>
    </button>
  );
}
