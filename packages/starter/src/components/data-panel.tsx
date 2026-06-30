import { DataSubsection, Histogram, LineChart } from "@concord-consortium/mass-sims-shared";
import type { RecordedTrial } from "../model/types";
import "./data-panel.scss";

const SAMPLE_EVERY = 10; // frames per avgDistanceSeries sample (mirrors the model)
const TS_H = 130; // time-series chart height
const HIST_H = 160; // histogram height (a little taller for its axis titles)

export interface DataPanelProps {
  /** The active trial whose data drives both charts, or null when there is none. */
  trial: RecordedTrial | null;
  /**
   * In-progress avg-distance series from the currently-running trial, or null/undefined when
   * no run is active. When set, the time-series chart prefers this over the selected trial's
   * recorded `output.avgDistanceSeries`, letting the chart animate as the run unfolds. App
   * is responsible for clearing this on every trial-list-mutating boundary so a stale series
   * from a previous run can never be shown.
   */
  liveSeries?: readonly number[] | null;
}

export function DataPanel({ trial, liveSeries }: DataPanelProps) {
  const selected = trial;
  // Prefer the in-progress live series while it's set; otherwise fall back to the trial's
  // committed output series (post-completion) or an empty series (empty trial).
  const selectedSeries = liveSeries ?? selected?.output?.avgDistanceSeries ?? [];
  // Walker distances from the origin for the distribution histogram — only present once the
  // trial completes. The sim maps walkers → distances; the shared <Histogram> takes plain
  // numbers and bins them.
  const distances = (selected?.finalTransient?.walkers ?? []).map((w) => Math.hypot(w.x, w.y));
  // Shape the avg-distance samples into (frame, avg) points for the shared LineChart. Sample i
  // lands at frame (i + 1) * SAMPLE_EVERY (the model samples every SAMPLE_EVERY frames).
  const seriesData = selectedSeries.map((avg, i) => ({ frame: (i + 1) * SAMPLE_EVERY, avg }));

  return (
    <>
      <DataSubsection title="Final Distance Distribution">
        <Histogram
          values={distances}
          height={HIST_H}
          ariaLabel="Final distance distribution"
          xLabel="Distance from start"
          yLabel="# of walkers"
          emptyState="No data"
        />
      </DataSubsection>
      <DataSubsection title="Average Distance Over Time">
        <LineChart
          data={seriesData}
          xKey="frame"
          yKey="avg"
          height={TS_H}
          ariaLabel="Average distance over time"
          emptyState="No data"
        />
      </DataSubsection>
    </>
  );
}
