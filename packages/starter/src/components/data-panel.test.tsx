import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecordedTrial } from "../model/types";
import { DataPanel } from "./data-panel";

const runTrial = (avg: number): RecordedTrial => ({
  id: `id-${avg}`,
  input: { walkerCount: 50, stepSize: 1, framesPerTrial: 100, seed: "x" },
  output: { avgDistance: avg, stdDevDistance: 2, avgDistanceSeries: [1, 2, 3, 4, 5] },
  finalTransient: null,
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

  it("shows a zero count and dashes in the summary before any trial is run", () => {
    const { getByText, getAllByText } = render(
      <DataPanel trials={[emptyTrial()]} selectedIndex={0} />,
    );
    expect(getByText("Trials run")).toBeInTheDocument();
    expect(getByText("0")).toBeInTheDocument();
    // Average distance + std. deviation both show an em dash until there's data.
    expect(getAllByText("—")).toHaveLength(2);
  });

  it("computes summary stats from the run trials only (excludes empty trials)", () => {
    const trials = [runTrial(4), runTrial(6), runTrial(8), emptyTrial("g")];
    const { getByText } = render(<DataPanel trials={trials} selectedIndex={null} />);
    // Average of run trials 4, 6, 8 is 6.00 — the unrun trial is excluded.
    expect(getByText(/6\.00/)).toBeInTheDocument();
  });

  it("always renders the time-series chart, with or without data", () => {
    const withData = render(<DataPanel trials={[runTrial(5)]} selectedIndex={0} />);
    expect(withData.getByLabelText(/distance over time/i)).toBeInTheDocument();
    withData.unmount();

    // The chart frame stays present even for an unrun, selected trial (it shows a "No data" state).
    const empty = render(<DataPanel trials={[emptyTrial()]} selectedIndex={0} />);
    expect(empty.getByLabelText(/distance over time/i)).toBeInTheDocument();
  });
});
