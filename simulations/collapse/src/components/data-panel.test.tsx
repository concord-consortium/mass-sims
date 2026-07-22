import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { END_YEAR, START_YEAR } from "../model/collapse";
import type { SimInput } from "../model/types";
import { DataPanel } from "./data-panel";

const wetLimestone: SimInput = {
  location: "bowling-green",
  wetness: "wet",
  soil: "limestone",
};
const granite: SimInput = {
  location: "bowling-green",
  wetness: "wet",
  soil: "granite",
};

describe("DataPanel", () => {
  it("shows an empty state when no trial is selected", () => {
    const { getByText } = render(<DataPanel input={null} year={START_YEAR} />);
    expect(getByText(/no trial selected/i)).toBeInTheDocument();
  });

  it("renders the erosion + carbonate meters with accessible values", () => {
    const { getByLabelText, getAllByRole } = render(
      <DataPanel input={wetLimestone} year={START_YEAR} />,
    );
    expect(getAllByRole("meter")).toHaveLength(2);
    // Erosion is 0 at the start year; carbonate is a landscape property (lots for karst limestone).
    expect(getByLabelText("Cave roof eroded")).toHaveAttribute("aria-valuenow", "0");
    expect(getByLabelText("Carbonate in groundwater")).toHaveAttribute("aria-valuenow", "250");
  });

  it("reports full roof erosion (in inches) and a collapse at 2014 for wet + limestone", () => {
    const { getByLabelText, getByText } = render(
      <DataPanel input={wetLimestone} year={END_YEAR} />,
    );
    expect(getByLabelText("Cave roof eroded")).toHaveAttribute("aria-valuenow", "240");
    expect(getByText(/roof collapsed/i)).toBeInTheDocument();
  });

  it("reports no roof erosion and no collapse for granite, however wet", () => {
    const { getByLabelText, getByText } = render(<DataPanel input={granite} year={END_YEAR} />);
    expect(getByLabelText("Cave roof eroded")).toHaveAttribute("aria-valuenow", "0");
    expect(getByText(/roof intact/i)).toBeInTheDocument();
  });
});
