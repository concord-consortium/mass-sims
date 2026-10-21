import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SimulationView } from "./simulation-view";

describe("SimulationView", () => {
  it("renders the four containers and the Cross Section region", () => {
    const { container, getByRole } = render(<SimulationView />);
    for (const name of ["timeline", "controls", "stage-row", "table-box"]) {
      expect(container.querySelector(`.collapse-${name}`)).toBeInTheDocument();
    }
    const crossSection = getByRole("region", { name: "Cross Section" });
    expect(crossSection).toHaveTextContent("Select a row in the table to see its cross section.");
  });
});
