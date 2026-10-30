import { useRef } from "react";
import CloseIcon from "../../assets/close-icon.svg?react";
import CompareIcon from "../../assets/compare-icon.svg?react";
import { useCompareActions } from "../../hooks/use-compare-actions";
import { useDialogLifecycle } from "./use-dialog-lifecycle";
import { useFocusTrap } from "./use-focus-trap";
import "./compare-trials.scss";

const LEGEND = [
  ["Years", "Years before collapse (yr)"],
  ["Rate", "Erosion rate (mm/1,000 yr)"],
  ["Rock", "Rock above cave (mm)"],
] as const;

/**
 * All four trials' samples side by side, over the Trials and Simulation panels. Mounted only while
 * open.
 *
 * A dialog, but not `aria-modal`: that would hide the live region, which is outside the dialog, and
 * silence every announcement. Making the rest of the frame inert does the isolating instead.
 */
export function CompareTrials() {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { closeCompare } = useCompareActions();
  useDialogLifecycle(rootRef, { initialFocus: closeRef, opener: ".collapse-compare-button" });
  useFocusTrap(rootRef);

  return (
    <div
      aria-label="Compare trials"
      className="collapse-compare"
      ref={rootRef}
      role="dialog"
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        closeCompare("escape");
      }}
    >
      <div className="collapse-compare-head">
        <CompareIcon className="collapse-compare-head-icon" aria-hidden="true" />
        <div className="collapse-compare-titles">
          <h2 className="collapse-compare-title">Compare Trials</h2>
          <div className="collapse-compare-legend">
            {LEGEND.map(([key, meaning], i) => (
              <span key={key}>
                {i > 0 && " | "}
                <b className="collapse-compare-key">{key}</b> = {meaning}
              </span>
            ))}
          </div>
        </div>
        <button
          aria-label="Close the trial comparison"
          className="collapse-compare-close"
          ref={closeRef}
          type="button"
          onClick={() => closeCompare("close")}
        >
          <CloseIcon className="collapse-compare-close-icon" aria-hidden="true" />
        </button>
      </div>
      <div className="collapse-compare-grid" />
    </div>
  );
}
