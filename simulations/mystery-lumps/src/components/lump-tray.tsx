import clsx from "clsx";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, type LumpId } from "../model/substances";
import { type Trial, untestedLumps } from "../model/trial";

import "./lump-tray.scss";

export interface LumpTrayProps {
  trial: Trial;
  /** The lump on the bench. It may already be spent, in which case it is no longer in the tray. */
  selectedLump: LumpId | null;
  onSelect: (lump: LumpId) => void;
}

/**
 * The lumps that still have material, across the full width of the Simulation column. Clicking
 * one puts it on the bench.
 *
 * A lump leaves the tray the moment its one test is run — there is nothing left to test it with.
 * What it showed stays in the Data column, which is the record; the tray is only a picker.
 */
export function LumpTray({ trial, selectedLump, onSelect }: LumpTrayProps) {
  const available = untestedLumps(trial);

  return (
    <div className="lump-tray">
      <div className="tray-title">Sample tray</div>
      {available.length === 0 ? (
        <p className="tray-empty">
          Every lump has been used. Start a new trial to test these samples again.
        </p>
      ) : (
        <ul className="tray-slots">
          {available.map((lump) => {
            // Unhandled lumps all look alike on purpose; the picture is the same placeholder
            // until the student has actually looked at one.
            const handled = trial.lumps[lump].handled;
            const visual = handled
              ? observe(LUMP_ASSIGNMENT[lump], "handle", null).visual
              : "unknown";
            return (
              <li key={lump}>
                <button
                  type="button"
                  className={clsx("tray-slot", { selected: lump === selectedLump })}
                  aria-pressed={lump === selectedLump}
                  onClick={() => onSelect(lump)}
                >
                  <span className={clsx("tray-lump", `visual-${visual}`)} aria-hidden="true" />
                  <span className="tray-letter">{lump}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
