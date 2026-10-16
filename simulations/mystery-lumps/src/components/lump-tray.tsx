import clsx from "clsx";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, LUMP_IDS, type LumpId } from "../model/substances";
import { type Trial, untestedLumps } from "../model/trial";

import "./lump-tray.scss";

export interface LumpTrayProps {
  trial: Trial;
  /** The lump on the bench, which may be one whose slot is now empty because its test is spent. */
  selectedLump: LumpId | null;
  onSelect: (lump: LumpId) => void;
}

/**
 * The five sample slots, across the full width of the Simulation column. Clicking a slot that
 * still holds a lump puts it on the bench.
 *
 * Running a test uses the lump up, and the lump is then gone from its slot — but the slot stays,
 * empty and unselectable. Keeping all five means the tray never reflows under the student's
 * hand, and an empty slot says plainly that there is nothing left to test there. What the lump
 * showed stays in the Data column, which is the record; the tray is only a picker.
 */
export function LumpTray({ trial, selectedLump, onSelect }: LumpTrayProps) {
  const anyLeft = untestedLumps(trial).length > 0;

  return (
    <div className="lump-tray">
      <div className="tray-title">Sample tray</div>
      <ul className="tray-slots">
        {LUMP_IDS.map((lump) => {
          const record = trial.lumps[lump];
          const usedUp = record.result !== null;
          // Unhandled lumps all look alike on purpose; the picture is the same placeholder
          // until the student has actually looked at one.
          const visual = record.handled
            ? observe(LUMP_ASSIGNMENT[lump], "handle", null).visual
            : "unknown";
          return (
            <li key={lump}>
              <button
                type="button"
                className={clsx("tray-slot", {
                  selected: lump === selectedLump,
                  "used-up": usedUp,
                })}
                aria-pressed={lump === selectedLump}
                aria-label={usedUp ? `Lump ${lump}, used up` : `Lump ${lump}`}
                disabled={usedUp}
                onClick={() => onSelect(lump)}
              >
                {usedUp ? (
                  <span className="tray-empty-slot" aria-hidden="true" />
                ) : (
                  <span className={clsx("tray-lump", `visual-${visual}`)} aria-hidden="true" />
                )}
                <span className="tray-letter">{lump}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {anyLeft ? null : (
        <p className="tray-note">
          Every lump has been used. Start a new trial to test these samples again.
        </p>
      )}
    </div>
  );
}
