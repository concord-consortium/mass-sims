import clsx from "clsx";
import type { ReactNode } from "react";
import { TRIAL_LETTERS_DEFAULT as LETTERS } from "../../trials/constants";
import "./trial-card.scss";

export interface TrialCardProps {
  children?: ReactNode;
  index: number;
  selected: boolean;
  onSelect: () => void;
  /** Overrides the default `"Trial X"` accessible name — e.g. to enrich it with trial state. */
  ariaLabel?: string;
  /** Roving-tabindex control for the option button (selected → `0`, the rest → `-1`). */
  tabIndex?: number;
}

/**
 * A trial rendered as a single-select listbox `option`: a presentational (`role="none"`) wrapper
 * around a real `<button role="option">`, so the option reads as a direct child of the consumer's
 * `role="listbox"` container (no unannotated `<div>` in the owned chain). Selected + roving state is
 * driven by `selected` (→ `aria-selected` + the `.selected` class) and `tabIndex`.
 *
 * The reset affordance is deliberately NOT part of the card — a `listbox` must not contain focusable
 * non-option descendants, so consumers render a single `<TrialResetButton>` at the panel level,
 * outside the listbox and positioned over the selected card.
 *
 * Letter assignment is index-based and bounded to A through J (10 trials max). If a sim needs more,
 * expose a `letter` prop in a follow-up.
 */
export function TrialCard({
  children,
  index,
  selected,
  onSelect,
  ariaLabel,
  tabIndex,
}: TrialCardProps) {
  const letter = LETTERS[index] ?? "?";

  return (
    // Presentational wrapper: keeps the fixed footprint + `.selected` styling and lets the option
    // button read as a direct child of the listbox.
    <div className={clsx("trial-card-wrapper", { selected })} role="none">
      <button
        type="button"
        className="trial-card"
        role="option"
        aria-selected={selected}
        aria-label={ariaLabel ?? `Trial ${letter}`}
        tabIndex={tabIndex}
        onClick={onSelect}
      >
        <span className="letter-badge" aria-hidden="true">
          {letter}
        </span>
        <div className="body">{children}</div>
      </button>
    </div>
  );
}
