import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { useEffect, useRef, useState } from "react";
import type { RecordedTrial } from "../model/types";
import "./data-panel.scss";

const CHART_H = 130;
const CHART_MARGIN = { top: 12, right: 12, bottom: 22, left: 36 };
const SAMPLE_EVERY = 10; // frames per avgDistanceSeries sample (mirrors the model)

export interface DataPanelProps {
  trials: readonly RecordedTrial[];
  /** Index of the selected trial, or null. Its series drives the time-series chart. */
  selectedIndex: number | null;
  /**
   * In-progress avg-distance series from the currently-running trial, or null/undefined when
   * no run is active. When set, the time-series chart prefers this over the selected trial's
   * recorded `output.avgDistanceSeries`, letting the chart animate as the run unfolds. App
   * is responsible for clearing this on every trial-list-mutating boundary so a stale series
   * from a previous run can never be shown.
   */
  liveSeries?: readonly number[] | null;
}

export function DataPanel({ trials, selectedIndex, liveSeries }: DataPanelProps) {
  // Aggregate only trials that have been run; empty trials in the list contribute no data.
  const distances: number[] = [];
  for (const trial of trials) {
    if (trial.output) distances.push(trial.output.avgDistance);
  }
  const runCount = distances.length;
  const summary = computeSummary(distances);

  const selected =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < trials.length
      ? trials[selectedIndex]
      : null;
  // Prefer the in-progress live series while it's set; otherwise fall back to the trial's
  // committed output series (post-completion) or an empty series (empty trial).
  const selectedSeries = liveSeries ?? selected?.output?.avgDistanceSeries ?? [];

  return (
    <>
      <DataSubsection title="Summary Statistics">
        <dl className="summary">
          <dt>Trials run</dt>
          <dd>{runCount}</dd>
          <dt>Average distance</dt>
          <dd>{runCount > 0 ? summary.avgDistance.toFixed(2) : "—"}</dd>
          <dt>Std. deviation</dt>
          <dd>{runCount > 0 ? summary.stdDevDistance.toFixed(2) : "—"}</dd>
        </dl>
      </DataSubsection>
      <DataSubsection title="Average Distance Over Time">
        <TimeSeriesChart series={selectedSeries} />
      </DataSubsection>
    </>
  );
}

function computeSummary(distances: readonly number[]): {
  avgDistance: number;
  stdDevDistance: number;
} {
  if (distances.length === 0) return { avgDistance: 0, stdDevDistance: 0 };
  const avgDistance = distances.reduce((s, d) => s + d, 0) / distances.length;
  const variance =
    distances.length > 1
      ? distances.reduce((s, d) => s + (d - avgDistance) ** 2, 0) / (distances.length - 1)
      : 0;
  return { avgDistance, stdDevDistance: Math.sqrt(variance) };
}

/**
 * Small line chart of avg distance over a trial's frames. Always renders its frame (plot border +
 * y-axis ticks/labels + x-axis ticks); draws the series line when there are ≥ 2 samples, otherwise
 * shows a "No data" state (the selected trial may not have been run yet).
 */
function TimeSeriesChart({ series }: { series: readonly number[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // The chart fills its container's width (full Data column minus padding); track the laid-out
  // width so the backing store matches it (guarded — jsdom lacks ResizeObserver in tests).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setWidth(Math.round(entries[0].contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Render at device-pixel resolution so the chart is crisp (not upscaled/fuzzy) on HiDPI
    // screens; CSS size stays logical (width × CHART_H), so we draw in logical units.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = CHART_H * dpr;
    ctx.scale(dpr, dpr);
    drawChart(ctx, width, CHART_H, series);
  }, [series, width]);
  return (
    <canvas ref={ref} className="series-chart" aria-label="Average distance over time chart" />
  );
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  series: readonly number[],
) {
  ctx.clearRect(0, 0, width, height);
  const { top, right, bottom, left } = CHART_MARGIN;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const hasData = series.length >= 2;
  const max = hasData ? Math.max(...series, 1) : 1;

  // Y-axis ticks + gridlines + labels (0, max/2, max).
  ctx.font = "14px Lato, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const yTicks = 3;
  for (let i = 0; i < yTicks; i++) {
    const frac = i / (yTicks - 1);
    const y = top + plotH - frac * plotH;
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.stroke();
    ctx.strokeStyle = "#999";
    ctx.beginPath();
    ctx.moveTo(left - 3, y);
    ctx.lineTo(left, y);
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.fillText((max * frac).toFixed(1), left - 5, y);
  }

  // Plot border (the axes box).
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, plotW, plotH);

  // X-axis ticks + labels (frame range).
  ctx.fillStyle = "#555";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("0", left, top + plotH + 4);
  if (hasData) {
    ctx.textAlign = "right";
    ctx.fillText(String(series.length * SAMPLE_EVERY), left + plotW, top + plotH + 4);
  }

  if (!hasData) {
    ctx.fillStyle = "#999";
    ctx.font = "14px Lato, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("No data", left + plotW / 2, top + plotH / 2);
    return;
  }

  // Series line.
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  series.forEach((v, i) => {
    const x = left + (i / (series.length - 1)) * plotW;
    const y = top + plotH - (v / max) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}
