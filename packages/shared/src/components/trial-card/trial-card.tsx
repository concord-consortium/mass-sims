import clsx from "clsx";
import type { ReactNode } from "react";
import ResetIcon from "../../assets/reset-icon.svg?react";
import { TRIAL_LETTERS_DEFAULT as LETTERS } from "../../trials/constants";
import "./trial-card.scss";

export interface TrialCardProps {
  children?: ReactNode;
  index: number;
  selected: boolean;
  resetDisabled?: boolean;
  onSelect: () => void;
  onReset: () => void;
  /** Overrides the default `"Trial X"` accessible name — e.g. to enrich it with trial state. */
  ariaLabel?: string;
  /** Roving-tabindex control for the card button. Omitted → native (always tabbable). */
  tabIndex?: number;
  /** ARIA role for the card button — e.g. `"tab"` when used inside a tablist. Omitted → native button. */
  role?: string;
  /** `aria-selected` state, for tablist usage. Omitted when `undefined` (non-tab consumers). */
  ariaSelected?: boolean;
}

/**
 * The common chrome around a recorded trial. Renders a wrapper div containing two SIBLING
 * buttons: the card itself (activates `onSelect`) and a reset affordance (activates
 * `onReset`, only rendered when `selected`). Both are real `<button>` elements — NO
 * nested buttons, NO `role="button"` workarounds. The wrapper provides the positioning
 * context; CSS visually places the reset button overhanging the card's upper-right corner.
 *
 * Letter assignment is index-based and bounded to A through J (10 trials max). If a sim
 * needs more, expose a `letter` prop in a follow-up.
 */
export function TrialCard({
  children,
  index,
  selected,
  resetDisabled = false,
  onSelect,
  onReset,
  ariaLabel,
  tabIndex,
  role,
  ariaSelected,
}: TrialCardProps) {
  const letter = LETTERS[index] ?? "?";
  // Tab semantics are opt-in: only attach `role` + `aria-selected` when a role is supplied, so a
  // plain-button consumer never receives an `aria-selected` its role wouldn't support.
  const tabProps = role ? { role, "aria-selected": ariaSelected } : {};

  return (
    <div className={clsx("trial-card-wrapper", { selected })}>
      <button
        type="button"
        className="trial-card"
        aria-label={ariaLabel ?? `Trial ${letter}`}
        tabIndex={tabIndex}
        onClick={onSelect}
        {...tabProps}
      >
        <span className="letter-badge" aria-hidden="true">
          {letter}
        </span>
        <div className="body">{children}</div>
      </button>
      {selected ? (
        <button
          type="button"
          className="reset-button"
          aria-label={`Reset trial ${letter}`}
          aria-disabled={resetDisabled || undefined}
          onClick={() => {
            if (!resetDisabled) onReset();
          }}
        >
          <ResetIcon aria-hidden="true" className="reset-button-icon" />
        </button>
      ) : null}
    </div>
  );
}
