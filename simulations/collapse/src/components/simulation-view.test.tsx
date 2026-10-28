import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { SimulationView } from "./simulation-view";

function renderView() {
  return render(
    <RootStoreProvider store={createRootStore()}>
      <SimulationView />
    </RootStoreProvider>,
  );
}

describe("SimulationView", () => {
  it("renders the four containers and the Cross Section region", () => {
    const { container, getByRole } = renderView();
    for (const name of ["timeline", "controls", "stage-row", "table-box"]) {
      expect(container.querySelector(`.collapse-${name}`)).toBeInTheDocument();
    }
    const crossSection = getByRole("region", { name: "Cross Section" });
    expect(crossSection).toHaveTextContent("Select a row in the table to see its cross section.");
  });

  it("renders the timeline slider and the year stepper", () => {
    const { getByRole } = renderView();
    expect(getByRole("slider", { name: "Years before collapse" })).toBeInTheDocument();
    expect(
      getByRole("button", { name: "Earlier, more years before collapse" }),
    ).toBeInTheDocument();
    expect(getByRole("button", { name: "Later, fewer years before collapse" })).toBeInTheDocument();
  });

  it("renders a Sample button", () => {
    const { getByRole } = renderView();
    expect(getByRole("button", { name: "Sample" })).toBeInTheDocument();
  });
});
