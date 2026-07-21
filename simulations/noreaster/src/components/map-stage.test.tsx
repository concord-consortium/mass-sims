import { act, render, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createRootStore, type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { configureStrong } from "../stores/test-helpers";
import { MapStage, type MapView } from "./map-stage";

function renderStage(mapView: MapView = "street", store: RootStoreInstance = createRootStore()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>{children}</RootStoreProvider>
  );
  return { store, ...render(<MapStage mapView={mapView} />, { wrapper }) };
}

describe("MapStage — structure", () => {
  it("renders the base map as an informative image named by its description", () => {
    const { getByRole } = renderStage();
    // The map's meaning is carried by the street <img> alt (the full verbatim description).
    expect(getByRole("img", { name: /Map of the eastern United States/ })).toBeInTheDocument();
  });

  it("renders the satellite basemap as a decorative (unnamed) layer", () => {
    const { container, getAllByRole } = renderStage();
    // Only the street image is exposed to assistive tech; the satellite layer has an empty alt.
    expect(getAllByRole("img")).toHaveLength(1);
    expect(container.querySelector(".nor-map-img--satellite")).toBeInTheDocument();
  });

  it("reflects the basemap choice in data-map-view", () => {
    const { container } = renderStage("satellite");
    expect(container.querySelector(".nor-stage")).toHaveAttribute("data-map-view", "satellite");
  });

  it("renders the compass, four arrows, four pills, and the Boston marker as decorative overlays", () => {
    const { container } = renderStage();
    const overlays = [
      ...container.querySelectorAll(".nor-arrow, .nor-pill, .nor-boston, .nor-compass"),
    ];
    expect(overlays).toHaveLength(10); // 4 arrows + 4 pills + boston + compass
    expect(overlays.every((o) => o.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("renders the four numbered pathway pills with their direction labels", () => {
    const { container } = renderStage();
    const stage = container.querySelector(".nor-stage") as HTMLElement;
    for (const label of ["N/NW", "W", "S/SE", "NE"]) {
      expect(within(stage).getByText(label)).toBeInTheDocument();
    }
  });
});

describe("MapStage — pre-run prompt", () => {
  it("is absent until the setup is complete", () => {
    const { container } = renderStage();
    expect(container.querySelector(".nor-prompt")).toBeNull();
  });

  it("appears once the setup is complete and the trial hasn't run", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    act(() => configureStrong(store.activeTrial));
    expect(container.querySelector(".nor-prompt")).toHaveTextContent(
      "Click Run to see if a nor’easter forms",
    );
  });

  it("disappears once the trial has been run", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    act(() => {
      configureStrong(store.activeTrial);
      store.activeTrial.run();
    });
    expect(container.querySelector(".nor-prompt")).toBeNull();
  });
});

describe("MapStage — arrow tint from selections", () => {
  it("starts every arrow neutral and undimmed", () => {
    const { container } = renderStage();
    for (const arrow of container.querySelectorAll(".nor-arrow")) {
      expect(arrow).toHaveAttribute("data-tint", "neutral");
      expect(arrow).not.toHaveAttribute("data-dimmed");
    }
  });

  it("tints the chosen pathway arrows and dims the unchosen siblings", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    const arrow = (n: number) => container.querySelector(`.nor-arrow[data-arrow="${n}"]`);

    act(() => {
      store.activeTrial.setLandPathway("N/NW"); // arrow 1
      store.activeTrial.setLandTemperature("Warm");
      store.activeTrial.setOceanPathway("NE"); // arrow 3, derived Cool
    });

    expect(arrow(1)).toHaveAttribute("data-tint", "warm");
    expect(arrow(4)).toHaveAttribute("data-dimmed", "true"); // other land arrow
    expect(arrow(3)).toHaveAttribute("data-tint", "cool");
    expect(arrow(2)).toHaveAttribute("data-dimmed", "true"); // other ocean arrow
  });

  it("returns arrows to neutral after the trial is reset", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    act(() => {
      store.activeTrial.setLandPathway("N/NW");
      store.activeTrial.setLandTemperature("Warm");
    });
    act(() => store.resetTrial());
    for (const arrow of container.querySelectorAll(".nor-arrow")) {
      expect(arrow).toHaveAttribute("data-tint", "neutral");
      expect(arrow).not.toHaveAttribute("data-dimmed");
    }
  });
});
