import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import type { TrialState } from "../../model/trial";
import {
  LEGEND_DASH,
  LEGEND_HEALTHY,
  LEGEND_INFECTED,
  PHENOTYPES_PILL_DEFAULT,
  PHENOTYPES_TITLE,
} from "./constants";
import { PhenotypesPie } from "./phenotypes-pie";
import { ResistanceBarChart } from "./resistance-bar-chart";

import "./data-panel.scss";

export interface BananasDataPanelProps {
  /** Reserved for MAS-12 data wiring; ignored in MAS-11. */
  trial: TrialState;
}

// Two-line bar-chart title whose break point shifts with the container width (see the .rt-break
// rules in data-panel.scss). Each .rt-break injects a forced newline via its ::after when shown;
// toggling which one shows moves the break without a <br>.
const resistanceTitle = (
  <span className="resistance-title">
    {"Fungus Resistance"}
    <span className="rt-break rt-break--1" />
    {" over"}
    <span className="rt-break rt-break--2" />
    {" All Crosses"}
  </span>
);

export function BananasDataPanel({ trial }: BananasDataPanelProps) {
  // The `trial` prop exists so MAS-12 can wire counts/series in without a signature change;
  // intentionally unused here.
  void trial;

  return (
    <div className="bananas-data-panel">
      <DataSubsection title={PHENOTYPES_TITLE}>
        <span className="phenotypes-pill">{PHENOTYPES_PILL_DEFAULT}</span>
        <div className="data-chart-body">
          <PhenotypesPie totals={null} />
        </div>
        <div className="data-legend phenotypes-legend">
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch phenotypes-swatch--healthy" />
              {LEGEND_HEALTHY}
            </span>
            <span className="legend-pct">{LEGEND_DASH}</span>
          </span>
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch phenotypes-swatch--infected" />
              {LEGEND_INFECTED}
            </span>
            <span className="legend-pct">{LEGEND_DASH}</span>
          </span>
        </div>
      </DataSubsection>
      <DataSubsection title={resistanceTitle}>
        <ResistanceBarChart series={null} />
        <div className="data-legend resistance-legend">
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch resistance-swatch--healthy" />
              {LEGEND_HEALTHY}
            </span>
          </span>
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch resistance-swatch--infected" />
              {LEGEND_INFECTED}
            </span>
          </span>
        </div>
      </DataSubsection>
    </div>
  );
}
