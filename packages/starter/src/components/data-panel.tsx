import { DataSubsection } from "@concord-consortium/mass-sims-shared";
import { useEffect, useRef, useState } from "react";
import type { RecordedTrial, Walker } from "../model/types";
import "./data-panel.scss";

type Margin = { top: number; right: number; bottom: number; left: number };

const SAMPLE_EVERY = 10; // frames per avgDistanceSeries sample (mirrors the model)
const TARGET_BINS = 7; // aim for ~7 histogram bins; the actual count depends on the round bin width

// The histogram is a little taller and has more left/bottom room than the time-series chart so its
// axis titles ("# of walkers", "Distance from start") have somewhere to sit.
const TS_H = 130;
const TS_MARGIN: Margin = { top: 12, right: 12, bottom: 22, left: 36 };
const HIST_H = 160;
const HIST_MARGIN: Margin = { top: 12, right: 12, bottom: 40, left: 46 };

export interface DataPanelProps {
  trials: readonly RecordedTrial[];
  /** Index of the selected trial, or null. Its data drives both charts. */
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
  const selected =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < trials.length
      ? trials[selectedIndex]
      : null;
  // Prefer the in-progress live series while it's set; otherwise fall back to the trial's
  // committed output series (post-completion) or an empty series (empty trial).
  const selectedSeries = liveSeries ?? selected?.output?.avgDistanceSeries ?? [];
  // Final walker positions for the distribution histogram — only present once the trial completes.
  const finalWalkers = selected?.finalTransient?.walkers ?? [];

  return (
    <>
      <DataSubsection title="Final Distance Distribution">
        <Histogram walkers={finalWalkers} />
      </DataSubsection>
      <DataSubsection title="Average Distance Over Time">
        <TimeSeriesChart series={selectedSeries} />
      </DataSubsection>
    </>
  );
}

/** Round a raw step up to a friendly 1, 2, or 5 × 10ⁿ value, so axis labels read as round numbers. */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const frac = raw / pow;
  const niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * pow;
}

/**
 * Group each walker's distance from the origin into fixed, round-width bins starting at 0. The bin
 * width is the `niceStep` of `max / targetBinCount`, so the bin boundaries are round numbers a
 * student can read off the axis. The bin count fits the data (the farthest walkers land in the
 * last bin, so there is no empty trailing bin). Returns the per-bin `counts`, the `binWidth`, and
 * `max` (the round upper bound = `counts.length * binWidth`). With no walkers (or all at the
 * origin) the counts collapse into a single first bin.
 */
export function histogramBins(
  walkers: readonly Walker[],
  targetBinCount: number,
): { counts: number[]; binWidth: number; max: number } {
  const distances = walkers.map((w) => Math.hypot(w.x, w.y));
  const maxDistance = distances.reduce((m, d) => Math.max(m, d), 0);
  if (maxDistance === 0) {
    return { counts: [distances.length], binWidth: 1, max: 1 };
  }
  const binWidth = niceStep(maxDistance / targetBinCount);
  // Fit the bins to the data — the last bin holds the farthest walkers, so the plot has no empty
  // trailing band. Every round boundary is labeled on the axis (see drawHistogram), so the labels
  // stay evenly spaced and reach the right edge regardless of how many bins there are.
  const binCount = Math.ceil(maxDistance / binWidth);
  const counts = new Array<number>(binCount).fill(0);
  for (const d of distances) {
    counts[Math.min(binCount - 1, Math.floor(d / binWidth))] += 1;
  }
  return { counts, binWidth, max: binCount * binWidth };
}

/**
 * Bar chart of the selected trial's final walker-distance distribution. Renders its frame (plot
 * border + axes + titles) always; draws bars when the trial has completed (walkers present),
 * otherwise a "No data" state.
 */
function Histogram({ walkers }: { walkers: readonly Walker[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
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
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = HIST_H * dpr;
    ctx.scale(dpr, dpr);
    drawHistogram(ctx, width, HIST_H, walkers);
  }, [walkers, width]);
  return (
    <canvas ref={ref} className="histogram-chart" aria-label="Final distance distribution chart" />
  );
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
    // screens; CSS size stays logical (width × TS_H), so we draw in logical units.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = TS_H * dpr;
    ctx.scale(dpr, dpr);
    drawChart(ctx, width, TS_H, series);
  }, [series, width]);
  return (
    <canvas ref={ref} className="series-chart" aria-label="Average distance over time chart" />
  );
}

/**
 * Shared axis frame: the plot border always, plus y-axis gridlines/ticks/labels when `showTicks`
 * is set. Ticks are suppressed in the empty "No data" state, where the numbers would be
 * meaningless placeholders. Returns the plot rect.
 */
function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  margin: Margin,
  yMax: number,
  yLabel: (value: number) => string,
  showTicks: boolean,
) {
  const { top, right, bottom, left } = margin;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  if (showTicks) {
    ctx.font = "13px Lato, sans-serif";
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
      ctx.fillText(yLabel(yMax * frac), left - 5, y);
    }
  }
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(left, top, plotW, plotH);
  return { top, left, plotW, plotH };
}

function drawNoData(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  w: number,
  h: number,
) {
  ctx.fillStyle = "#999";
  ctx.font = "13px Lato, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("No data", left + w / 2, top + h / 2);
}

/** Axis title centered below the plot (x) and rotated up the left edge (y). */
function drawAxisTitles(
  ctx: CanvasRenderingContext2D,
  height: number,
  top: number,
  left: number,
  plotW: number,
  plotH: number,
  xTitle: string,
  yTitle: string,
) {
  ctx.fillStyle = "#555";
  ctx.font = "13px Lato, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(xTitle, left + plotW / 2, height - 6);

  ctx.save();
  ctx.translate(11, top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = "middle";
  ctx.fillText(yTitle, 0, 0);
  ctx.restore();
}

function drawHistogram(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  walkers: readonly Walker[],
) {
  ctx.clearRect(0, 0, width, height);
  const hasData = walkers.length > 0;
  const { counts, binWidth } = histogramBins(walkers, TARGET_BINS);
  const maxCount = Math.max(...counts, 1);
  const yMax = niceStep(maxCount);
  const { top, left, plotW, plotH } = drawAxes(
    ctx,
    width,
    height,
    HIST_MARGIN,
    yMax,
    (v) => String(Math.round(v)),
    hasData,
  );
  drawAxisTitles(ctx, height, top, left, plotW, plotH, "Distance from start", "# of walkers");

  if (!hasData) {
    drawNoData(ctx, left, top, plotW, plotH);
    return;
  }

  // X-axis labels at every round bin boundary — evenly spaced, with the last on the right edge.
  ctx.fillStyle = "#555";
  ctx.font = "13px Lato, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= counts.length; i += 1) {
    ctx.fillText(String(i * binWidth), left + (i / counts.length) * plotW, top + plotH + 4);
  }

  // Bars (scaled to the round y-axis max so they line up with the gridlines).
  ctx.fillStyle = "#666";
  const barGap = 2;
  const barW = plotW / counts.length;
  counts.forEach((count, i) => {
    if (count === 0) return;
    const h = (count / yMax) * plotH;
    ctx.fillRect(left + i * barW + barGap / 2, top + plotH - h, barW - barGap, h);
  });
}

function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  series: readonly number[],
) {
  ctx.clearRect(0, 0, width, height);
  const hasData = series.length >= 2;
  const max = hasData ? Math.max(...series, 1) : 1;
  const { top, left, plotW, plotH } = drawAxes(
    ctx,
    width,
    height,
    TS_MARGIN,
    max,
    (v) => v.toFixed(1),
    hasData,
  );

  if (!hasData) {
    drawNoData(ctx, left, top, plotW, plotH);
    return;
  }

  // X-axis labels: frame range.
  ctx.fillStyle = "#555";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("0", left, top + plotH + 4);
  ctx.textAlign = "right";
  ctx.fillText(String(series.length * SAMPLE_EVERY), left + plotW, top + plotH + 4);

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
