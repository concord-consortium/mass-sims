import { Announcer } from "@concord-consortium/mass-sims-shared";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createRootStore, RootStoreProvider } from "../stores/root-store";
import { SimulationView } from "./simulation-view";

function renderView(store = createRootStore()) {
  return render(
    <RootStoreProvider store={store}>
      <Announcer>
        <SimulationView />
      </Announcer>
    </RootStoreProvider>,
  );
}

describe("SimulationView", () => {
  it("renders the four containers and the Cross Section region", () => {
    const { container, getByRole } = renderView();
    for (const name of ["timeline", "controls", "stage-row", "stage"]) {
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

  it("captions the Cross Section box with the selected sample's year", () => {
    const store = createRootStore();
    const { getByRole } = renderView(store);
    const crossSection = getByRole("region", { name: "Cross Section" });
    act(() => {
      store.ui.setTimelineIndex(1);
      store.takeSample();
    });
    expect(crossSection.querySelector(".collapse-pic-caption")).toHaveTextContent(
      "150,000 yr before collapse",
    );
    expect(crossSection).not.toHaveTextContent("Select a row");
    act(() => store.ui.selectSample("A", null));
    expect(crossSection.querySelector(".collapse-pic-caption")).toBeNull();
    expect(crossSection).toHaveTextContent("Select a row in the table to see its cross section.");
  });
});
