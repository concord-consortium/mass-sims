import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { hillsideErosionPct, isCollapsed, roofErosionPct } from "../model/collapse";
import type { SimInput } from "../model/types";
import { ErosionMeter } from "./erosion-meter";
import "./data-panel.scss";

export interface DataPanelProps {
  /** The selected trial's settings (or null if none). */
  input: SimInput | null;
  /** Current year on the timeline (drives the live meter values). */
  year: number;
}

export function DataPanel({ input, year }: DataPanelProps) {
  if (!input) {
    return (
      <DataSubsection title="Erosion">
        <p className="empty">No trial selected.</p>
      </DataSubsection>
    );
  }

  const roof = roofErosionPct(input, year);
  const hill = hillsideErosionPct(input, year);
  const collapsed = isCollapsed(input, year);

  return (
    <div className="collapse-data-panel">
      <DataSubsection title="Erosion">
        <div className="erosion-content">
          <div className="erosion-meters">
            <ErosionMeter label="Cave roof eroded" value={roof} color="#7a5c3a" />
            <ErosionMeter label="Hillside eroded" value={hill} color="#9a8050" />
          </div>
          <p className={`outcome ${collapsed ? "outcome-collapsed" : ""}`}>
            {collapsed ? "Roof collapsed — car fell into the cave." : "Roof intact."}
          </p>
        </div>
      </DataSubsection>
    </div>
  );
}
