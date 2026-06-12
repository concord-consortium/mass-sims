import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulationPanel } from "./simulation-panel";

describe("SimulationPanel", () => {
  it("renders the ParentSelectors, status pill, offspring grid, and ControlBar", () => {
    const { getByLabelText, getByRole } = render(<SimulationPanel />);
    expect(getByLabelText("Parent 1")).toBeInTheDocument();
    // Pill text is split by inline <b> elements, so match on full text content.
    expect(getByRole("status")).toHaveTextContent("Crosses: 0 · Offspring: 0");
    expect(getByRole("region", { name: /offspring/i })).toBeInTheDocument();
    expect(getByRole("button", { name: "Cross Plants" })).toBeInTheDocument();
  });

  it("renders the status pill as a live region (aria-live=polite)", () => {
    const { getByRole } = render(<SimulationPanel />);
    expect(getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("shows the placeholder copy in the offspring grid initial state", () => {
    const { getByRole } = render(<SimulationPanel />);
    // Placeholder text is split by an inline <strong>, so match on full text content.
    expect(getByRole("region", { name: /offspring/i })).toHaveTextContent(
      /Click Cross Plants to see their offspring/i,
    );
  });
});
