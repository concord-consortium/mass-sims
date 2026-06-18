import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EMPTY_STATE_LABEL } from "./constants";
import { ResistanceBarChart } from "./resistance-bar-chart";

// jsdom has no ResizeObserver, so the chart renders at width 0 — the structure (gridlines, axis
// labels, empty-state text) is all present regardless of width, which is what these assert.

describe("ResistanceBarChart — empty frame", () => {
  it("renders an SVG with role=img and the no-data aria-label", () => {
    const { getByRole } = render(<ResistanceBarChart series={null} />);
    expect(
      getByRole("img", { name: "Fungus resistance over crosses: no data" }),
    ).toBeInTheDocument();
  });

  it("shows the 'No data' label", () => {
    const { getByText } = render(<ResistanceBarChart series={null} />);
    expect(getByText(EMPTY_STATE_LABEL)).toBeInTheDocument();
  });

  it("renders all five y-axis percentage labels", () => {
    const { getByText } = render(<ResistanceBarChart series={null} />);
    for (const label of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(getByText(label)).toBeInTheDocument();
    }
  });

  it("renders exactly five gridlines", () => {
    const { container } = render(<ResistanceBarChart series={null} />);
    // A specific class, not a raw <line> count — the baseline/future ticks are also <line>s.
    expect(container.querySelectorAll(".bar-chart-gridline")).toHaveLength(5);
  });
});
