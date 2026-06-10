import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordedTrial, Walker } from "../model/types";
import { DataPanel } from "./data-panel";

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
