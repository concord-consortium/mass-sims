import clsx from "clsx";
import type { CSSProperties } from "react";
import ResetIcon from "../../assets/reset-icon.svg?react";
import "./trial-reset-button.scss";

export interface TrialResetButtonProps {
  className?: string;
  disabled?: boolean;
  letter: string;
  style?: CSSProperties;
  onReset: () => void;
}

/**
 * The reset affordance for a trial: a real `<button>` with an `aria-hidden` icon, named
 * `"Reset trial X"`, disabled via `aria-disabled` + an activation guard (stays keyboard-focusable).
 * The sims render it once per panel, outside the trials listbox (a `listbox` must not contain
 * focusable non-options). Positioning is left to the consumer — pass `className`/`style` (the sims
 * position it over the selected card by index).
 */
export function TrialResetButton({
  letter,
  disabled = false,
  onReset,
  className,
  style,
}: TrialResetButtonProps) {
  return (
    <button
      aria-disabled={disabled || undefined}
      aria-label={`Reset trial ${letter}`}
      className={clsx("reset-button", className)}
      style={style}
      type="button"
      onClick={() => {
        if (!disabled) onReset();
      }}
    >
      <ResetIcon aria-hidden="true" className="reset-button-icon" />
    </button>
  );
}
