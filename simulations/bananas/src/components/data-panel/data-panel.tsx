import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { observer } from "mobx-react-lite";
import { useMemo } from "react";
import PillCloseIcon from "../../assets/icons/pill-close.svg?react";
import { useStores } from "../../stores/root-store";
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
  /** App-bridged DOM scroll: scrolls the Sim grid to the selected cross (needs App's gridRef). */
  onPillChipClick: () => void;
  /** App-bridged deselect: clears the selection and returns focus to the previously-selected row. */
  onPillCloseClick: () => void;
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

export const BananasDataPanel = observer(function BananasDataPanel({
  onPillChipClick,
  onPillCloseClick,
}: BananasDataPanelProps) {
  const rootStore = useStores();
  const trial = rootStore.activeTrial;
  const trialLetter = rootStore.ui.selectedTrialLetter;
  // `activeCross`, `phenotypeTotals`, and `resistanceSeries` are MST views — MobX memoizes them
  // with proper invalidation. `activeCross` is the bounds-checked selection (never the raw stored
  // selection index — see the Selection access contract).
  const activeCross = rootStore.activeCross;
  const totals = rootStore.phenotypeTotals;
  const series = rootStore.resistanceSeries;

  // Legend percentages, or `null` (→ en-dash placeholders) when there's no data. Derived from the
  // memoized `phenotypeTotals` view.
  const legendPcts = useMemo(() => {
    if (!totals) return null;
    const total = totals.healthy + totals.infected;
    if (total === 0) return null;
    const healthy = Math.round((totals.healthy / total) * 100);
    return { healthy, infected: 100 - healthy };
  }, [totals]);

  const selectedCrossLabel = activeCross !== null ? `cross ${activeCross + 1}` : "all crosses";

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
              // Non-essential convenience (scrolls the selected cross into view). Clickable by
              // pointer but kept out of the tab order — the scroll it performs is reachable by
              // keyboard elsewhere (the offspring grid is itself keyboard-scrollable).
              tabIndex={-1}
              onClick={onPillChipClick}
              aria-label={`Scroll to cross ${trialLetter}${activeCross + 1}`}
            >
              {`${trialLetter}${activeCross + 1}`}{" "}
              <span className="pill-chip-count">{`(${trial.crosses[activeCross].length} offspring)`}</span>
            </button>
            <button
              type="button"
              className="pill-close"
              onClick={onPillCloseClick}
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
          selectedCross={activeCross}
          trialLetter={trialLetter}
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
});
