import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { useMemo } from "react";
import PillCloseIcon from "../../assets/icons/pill-close.svg?react";
import { aggregateTotals, computeResistanceSeries } from "../../model/data-aggregations";
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
  trial: TrialState;
  selectedCross: number | null;
  onClearSelection: () => void;
  onPillChipClick: () => void;
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

export function BananasDataPanel({
  trial,
  selectedCross,
  onClearSelection,
  onPillChipClick,
}: BananasDataPanelProps) {
  // A selection is active only when it points at a real cross. Guarding both bounds means a stale
  // or corrupt index (negative, or past the end) falls back to the all-crosses view instead of
  // indexing trial.crosses out of range.
  const activeCross =
    selectedCross !== null && selectedCross >= 0 && selectedCross < trial.crosses.length
      ? selectedCross
      : null;

  // Phenotype totals in scope: a single cross when one is selected, otherwise all crosses.
  const totals = useMemo(() => {
    if (trial.crosses.length === 0) return null;
    const scope = activeCross !== null ? [trial.crosses[activeCross]] : trial.crosses;
    return aggregateTotals(scope);
  }, [trial.crosses, activeCross]);

  // Legend percentages, or `null` (→ en-dash placeholders) when there's no data.
  const legendPcts = useMemo(() => {
    if (!totals) return null;
    const total = totals.healthy + totals.infected;
    if (total === 0) return null;
    const healthy = Math.round((totals.healthy / total) * 100);
    return { healthy, infected: 100 - healthy };
  }, [totals]);

  const selectedCrossLabel = activeCross !== null ? `cross ${activeCross + 1}` : "all crosses";

  // Per-cross resistance percentages for the bar chart (always the full trial — selection only
  // highlights a group, it doesn't filter the series like the pie's totals).
  const series = useMemo(
    () => (trial.crosses.length === 0 ? null : computeResistanceSeries(trial.crosses)),
    [trial.crosses],
  );

  return (
    <div className="bananas-data-panel">
      <DataSubsection title={PHENOTYPES_TITLE}>
        {activeCross !== null ? (
          // Active filter chip: two flat <button> siblings inside a non-interactive <span>.
          // Close X is a sibling of the chip body, so its clicks don't bubble through the chip.
          <span className="phenotypes-pill phenotypes-pill--active">
            <button
              type="button"
              className="pill-chip"
              onClick={onPillChipClick}
              aria-label={`Scroll to cross ${activeCross + 1}`}
            >
              {/* The space before "(" is a non-breaking space (U+00A0) so the offspring count
                  doesn't wrap away from the cross label at narrow widths. */}
              {`A${activeCross + 1} (${trial.crosses[activeCross].length} offspring)`}
            </button>
            <button
              type="button"
              className="pill-close"
              onClick={onClearSelection}
              aria-label="Deselect cross, show all crosses"
            >
              <PillCloseIcon aria-hidden="true" />
            </button>
          </span>
        ) : (
          <span className="phenotypes-pill">{PHENOTYPES_PILL_DEFAULT}</span>
        )}
        <div className="data-chart-body">
          <PhenotypesPie totals={totals} selectedCrossLabel={selectedCrossLabel} />
        </div>
        <div className="data-legend phenotypes-legend">
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch phenotypes-swatch--healthy" />
              {LEGEND_HEALTHY}
            </span>
            <span className="legend-pct">
              {legendPcts ? `${legendPcts.healthy}%` : LEGEND_DASH}
            </span>
          </span>
          <span className="legend-item">
            <span className="legend-label">
              <span className="legend-swatch phenotypes-swatch--infected" />
              {LEGEND_INFECTED}
            </span>
            <span className="legend-pct">
              {legendPcts ? `${legendPcts.infected}%` : LEGEND_DASH}
            </span>
          </span>
        </div>
      </DataSubsection>
      <DataSubsection title={resistanceTitle}>
        <ResistanceBarChart
          series={series}
          fungusOn={trial.fungusOn}
          selectedCross={selectedCross}
        />
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
