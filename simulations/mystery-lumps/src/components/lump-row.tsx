import { LUMP_IDS, type LumpId } from "../model/substances";
import type { Trial } from "../model/trial";
import { LumpStation } from "./lump-station";

export interface LumpRowProps {
  trial: Trial;
  runningLump: LumpId | null;
  onHandle: (lump: LumpId) => void;
  onWaft: (lump: LumpId) => void;
}

export function LumpRow({ trial, runningLump, onHandle, onWaft }: LumpRowProps) {
  return (
    <div className="lump-row">
      {LUMP_IDS.map((lump) => (
        <LumpStation
          key={lump}
          lump={lump}
          record={trial.lumps[lump]}
          running={runningLump === lump}
          onHandle={onHandle}
          onWaft={onWaft}
        />
      ))}
    </div>
  );
}
