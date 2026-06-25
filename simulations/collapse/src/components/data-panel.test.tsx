import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { END_YEAR, START_YEAR } from "../model/collapse";
import type { SimInput } from "../model/types";
import { DataPanel } from "./data-panel";

const wetLimestone: SimInput = { wetness: "wet", wind: "calm", soil: "limestone" };
const bedrock: SimInput = { wetness: "wet", wind: "windy", soil: "bedrock" };

describe("DataPanel", () => {
  it("shows an empty state when no trial is selected", () => {
    const { getByText } = render(<DataPanel input={null} year={START_YEAR} />);
    expect(getByText(/no trial selected/i)).toBeInTheDocument();
  });

  it("renders both erosion meters with accessible values", () => {
    const { getAllByRole } = render(<DataPanel input={wetLimestone} year={START_YEAR} />);
    const meters = getAllByRole("meter");
    expect(meters).toHaveLength(2);
    // At the start year both are at 0%.
    for (const m of meters) expect(m).toHaveAttribute("aria-valuenow", "0");
  });

  it("reports full roof erosion and a collapse at 2014 for wet + limestone", () => {
    const { getByLabelText, getByText } = render(
      <DataPanel input={wetLimestone} year={END_YEAR} />,
    );
    expect(getByLabelText("Cave roof eroded")).toHaveAttribute("aria-valuenow", "100");
    expect(getByText(/roof collapsed/i)).toBeInTheDocument();
  });

  it("reports no roof erosion and no collapse for bedrock, however wet/windy", () => {
    const { getByLabelText, getByText } = render(<DataPanel input={bedrock} year={END_YEAR} />);
    expect(getByLabelText("Cave roof eroded")).toHaveAttribute("aria-valuenow", "0");
    expect(getByText(/roof intact/i)).toBeInTheDocument();
  });
});
