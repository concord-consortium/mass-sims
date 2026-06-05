import clsx from "clsx";
import type { ReactNode } from "react";

import resetIcon from "../../assets/reset-icon.svg";
import "./trial-card.scss";

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export interface TrialCardProps {
  children?: ReactNode;
  index: number;
  selected: boolean;
  resetDisabled?: boolean;
  onSelect: () => void;
  onReset: () => void;
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
}: TrialCardProps) {
  const letter = LETTERS[index] ?? "?";
  return (
    <div className={clsx("trial-card-wrapper", { selected })}>
      <button
        type="button"
        className="trial-card"
        aria-label={`Trial ${letter}`}
        onClick={onSelect}
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
          <img src={resetIcon} alt="" aria-hidden="true" className="reset-button-icon" />
        </button>
      ) : null}
    </div>
  );
}
