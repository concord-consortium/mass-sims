import clsx from "clsx";
import { observe } from "../model/observe";
import { LUMP_ASSIGNMENT, type LumpId } from "../model/substances";
import type { LumpRecord } from "../model/trial";

import "./lump-station.scss";

export interface LumpStationProps {
  lump: LumpId;
  record: LumpRecord;
  running: boolean;
  onHandle: (lump: LumpId) => void;
  onWaft: (lump: LumpId) => void;
}

/**
 * One lump, with whatever apparatus its test put it in. The lump stays in place for the whole
 * trial and keeps its end state afterwards — an empty tube where the salt dissolved — so the
 * row doubles as a picture of the trial.
 *
 * Handling and wafting are buttons on the lump rather than entries in the settings grid: both
 * are free, and putting them here means a free action can never be mistaken for spending the
 * lump's one shot.
 */
export function LumpStation({ lump, record, running, onHandle, onWaft }: LumpStationProps) {
  const substance = LUMP_ASSIGNMENT[lump];
  const result = record.result;
  const observation = result ? observe(substance, result.test, result.setting) : null;

  return (
    <div className={clsx("lump-station", { running, spent: result !== null })}>
      <div className="lump-letter">{lump}</div>
      <div
        className={clsx("lump-body", observation ? `visual-${observation.visual}` : "visual-none")}
        aria-hidden="true"
      />
      <div className="lump-captions">
        {record.handled ? (
          <p className="caption handled">{observe(substance, "handle", null).caption}</p>
        ) : null}
        {observation ? <p className="caption result">{observation.caption}</p> : null}
        {record.wafted ? (
          <p className="caption smell">{observe(substance, "waft", null, result).caption}</p>
        ) : null}
      </div>
      <div className="lump-actions">
        <button type="button" onClick={() => onHandle(lump)} aria-label={`Handle lump ${lump}`}>
          Handle
        </button>
        <button type="button" onClick={() => onWaft(lump)} aria-label={`Waft lump ${lump}`}>
          Waft
        </button>
      </div>
    </div>
  );
}
