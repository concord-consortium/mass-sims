import { observer } from "mobx-react-lite";
import { useLayoutEffect, useRef, useState } from "react";
import CloseIcon from "../../assets/close-icon.svg?react";
import CompareIcon from "../../assets/compare-icon.svg?react";
import { useCompareActions } from "../../hooks/use-compare-actions";
import { useStores } from "../../stores/root-store";
import { COLLAPSE_TRIAL_LETTERS } from "../../trial-conditions";
import { CompareColumn } from "./compare-column";
import { useCompareKeyboardNav } from "./use-compare-keyboard-nav";
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
export const CompareTrials = observer(function CompareTrials() {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const store = useStores();
  const { closeCompare } = useCompareActions();
  // The year under the pointer, and the year of the row with keyboard focus. Rows with the linked
  // year get the hover background in every column. Two values, so that a pointer leaving a row
  // gives the highlight back to the focused row instead of clearing it.
  const [hoveredYear, setHoveredYear] = useState<number | null>(null);
  const [focusedYear, setFocusedYear] = useState<number | null>(null);
  const linkedYear = hoveredYear ?? focusedYear;
  const allEmpty = !store.hasAnyProgress;
  useDialogLifecycle(rootRef, { initialFocus: closeRef, opener: ".collapse-compare-button" });
  useFocusTrap(rootRef);
  useCompareKeyboardNav(gridRef, setFocusedYear);
  // CSS cannot read the scrollbar's width, which is 0 for overlay scrollbars, so measure it on an
  // element that always scrolls.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const probe = document.createElement("div");
    probe.style.cssText = "overflow-y: scroll; width: 100px; flex: none";
    grid.append(probe);
    grid.style.setProperty("--scrollbar", `${probe.offsetWidth - probe.clientWidth}px`);
    probe.remove();
  }, []);

  return (
    <div
      aria-label="Compare trials"
      className="collapse-compare"
      ref={rootRef}
      role="dialog"
      // A click on text in the view focuses the root, not `body`, so Escape still reaches it.
      tabIndex={-1}
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
      <div
        className={allEmpty ? "collapse-compare-grid all-empty" : "collapse-compare-grid"}
        ref={gridRef}
      >
        {COLLAPSE_TRIAL_LETTERS.map((letter) => (
          <CompareColumn
            key={letter}
            letter={letter}
            linkedYear={linkedYear}
            onHover={setHoveredYear}
          />
        ))}
      </div>
      {allEmpty && (
        // One prompt across the four columns, on the heading rule, instead of four notices.
        <div className="collapse-compare-prompt">
          <div className="collapse-prompt-pill">
            Take samples in <b>each trial</b>, then compare them here
          </div>
        </div>
      )}
    </div>
  );
});
