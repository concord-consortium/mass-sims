import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordedTrial, Walker } from "../model/types";
import { DataPanel, histogramBins, niceStep } from "./data-panel";

const runTrial = (avg: number, walkers: Walker[] = [{ x: 3, y: 4 }]): RecordedTrial => ({
  id: `id-${avg}`,
  input: { walkerCount: walkers.length, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: { avgDistance: avg, stdDevDistance: 2, avgDistanceSeries: [1, 2, 3, 4, 5] },
  finalTransient: { frame: 100, walkers, avgDistanceSeries: [1, 2, 3, 4, 5] },
});

const emptyTrial = (id = "empty"): RecordedTrial => ({
  id,
  input: { walkerCount: 50, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: null,
  finalTransient: null,
});

describe("niceStep", () => {
  it("rounds a raw step up to a friendly 1/2/5 × 10ⁿ value", () => {
    expect(niceStep(0.8)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(4.4)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(44)).toBe(50);
  });
});

describe("histogramBins", () => {
  it("groups walker distances into fixed, round-width bins", () => {
    // Distances 0, 5, 12, 30; target 7 → raw 30/7 ≈ 4.3 → width 5; 6 bins spanning 0..30.
    const walkers: Walker[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 12, y: 0 },
      { x: 30, y: 0 },
    ];
    expect(histogramBins(walkers, 7)).toEqual({ counts: [1, 1, 1, 0, 0, 1], binWidth: 5, max: 30 });
  });

  it("fits the bin count to the data so the last bin holds the farthest walkers", () => {
    // Distances 0 and 25 → width 5, ceil(25/5)=5 bins; axis max 25, no empty trailing bin.
    const walkers: Walker[] = [
      { x: 0, y: 0 },
      { x: 25, y: 0 },
    ];
    expect(histogramBins(walkers, 7)).toEqual({ counts: [1, 0, 0, 0, 1], binWidth: 5, max: 25 });
  });

  it("returns a single empty bin when there are no walkers", () => {
    expect(histogramBins([], 7)).toEqual({ counts: [0], binWidth: 1, max: 1 });
  });

  it("collapses to the first bin when every walker is at the origin", () => {
    const walkers: Walker[] = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    expect(histogramBins(walkers, 7)).toEqual({ counts: [3], binWidth: 1, max: 1 });
  });
});

describe("DataPanel", () => {
  it("renders both DataSubsection h3 headings", () => {
    const { getAllByRole } = render(<DataPanel trials={[]} selectedIndex={null} />);
    expect(getAllByRole("heading", { level: 3 })).toHaveLength(2);
  });

  it("renders the Final Distance Distribution histogram for a completed selected trial", () => {
    const { getByRole, getByLabelText } = render(
      <DataPanel trials={[runTrial(5, [{ x: 3, y: 4 }])]} selectedIndex={0} />,
    );
    expect(
      getByRole("heading", { level: 3, name: "Final Distance Distribution" }),
    ).toBeInTheDocument();
    expect(getByLabelText(/distance distribution/i)).toBeInTheDocument();
  });

  it("renders the histogram frame even for an empty (unrun) selected trial", () => {
    // No finalTransient → the histogram shows its "No data" state but the canvas is still present.
    const { getByLabelText } = render(<DataPanel trials={[emptyTrial()]} selectedIndex={0} />);
    expect(getByLabelText(/distance distribution/i)).toBeInTheDocument();
  });

  it("always renders the time-series chart, with or without data", () => {
    const withData = render(<DataPanel trials={[runTrial(5)]} selectedIndex={0} />);
    expect(withData.getByLabelText(/distance over time/i)).toBeInTheDocument();
    withData.unmount();

    // The chart frame stays present even for an unrun, selected trial (it shows a "No data" state).
    const empty = render(<DataPanel trials={[emptyTrial()]} selectedIndex={0} />);
    expect(empty.getByLabelText(/distance over time/i)).toBeInTheDocument();
  });

  it("renders the chart with liveSeries when supplied (in-progress run on an empty trial)", () => {
    // Empty (unrun) selected trial but a live series is supplied — the chart should render with
    // the live data rather than showing "No data". jsdom can't introspect canvas pixels so we
    // assert the chart frame is present and the component renders without error.
    const { getByLabelText } = render(
      <DataPanel trials={[emptyTrial()]} selectedIndex={0} liveSeries={[1, 2, 3]} />,
    );
    expect(getByLabelText(/distance over time/i)).toBeInTheDocument();
  });

  it("falls back to the output series when liveSeries is null", () => {
    const { getByLabelText } = render(
      <DataPanel trials={[runTrial(5)]} selectedIndex={0} liveSeries={null} />,
    );
    // Check that the chart still renders against the output series.
    expect(getByLabelText(/distance over time/i)).toBeInTheDocument();
  });
});
