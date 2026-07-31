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

  it("layers the storm cloud over the Boston marker (paint order: Boston, storm, then arrows)", () => {
    const { container } = renderStage();
    const map = container.querySelector(".nor-map") as HTMLElement;
    const classes = [...map.children].map((el) => el.className);
    const bostonIdx = classes.findIndex((c) => c.includes("nor-boston"));
    const stormIdx = classes.findIndex((c) => c.includes("nor-storm"));
    const firstArrowIdx = classes.findIndex((c) => c.includes("nor-arrow"));
    // Same stacking context, all z-index:auto → paint order = document order. Boston must precede the
    // storm canvas (so the cloud covers it) and the storm must precede the arrows (arrows stay on top).
    // This layering is enforced only by JSX sibling order, and it has regressed once.
    expect(bostonIdx).toBe(0);
    expect(bostonIdx).toBeLessThan(stormIdx);
    expect(stormIdx).toBeLessThan(firstArrowIdx);
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
    expect(container.querySelector(".nor-prompt-backdrop")).toBeNull();
  });

  it("appears once the setup is complete and the trial hasn't run", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    act(() => configureStrong(store.activeTrial));
    expect(container.querySelector(".nor-prompt")).toHaveTextContent(
      "Click Run to see if a nor’easter forms",
    );
    // The blue backdrop that bleeds behind the pill's top is part of the prompt.
    expect(container.querySelector(".nor-prompt-backdrop")).not.toBeNull();
  });

  it("disappears once the trial has been run", () => {
    const store = createRootStore();
    const { container } = renderStage("street", store);
    act(() => {
      configureStrong(store.activeTrial);
      store.activeTrial.run();
    });
    expect(container.querySelector(".nor-prompt")).toBeNull();
    expect(container.querySelector(".nor-prompt-backdrop")).toBeNull();
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

describe("MapStage — run animation states (arrows + pills)", () => {
  // configureStrong selects land N/NW (arrow 1) + ocean S/SE (arrow 2); the companions are land W (4)
  // and ocean NE (3).
  const arrow = (c: HTMLElement, n: number) => c.querySelector(`.nor-arrow[data-arrow="${n}"]`);
  const pill = (c: HTMLElement, n: number) => c.querySelector(`.nor-pill[data-pathway="${n}"]`);

  it("while running: companions hidden, selected arrows runner-driven, all pills of selected kept", () => {
    const store = createRootStore();
    act(() => configureStrong(store.activeTrial));
    const { container } = renderStage("street", store);
    act(() => {
      store.beginRun();
    });
    // Selected arrows (1, 2) converge under the runner — no static run-state; their pills stay.
    expect(arrow(container, 1)).not.toHaveAttribute("data-run-state");
    expect(arrow(container, 2)).not.toHaveAttribute("data-run-state");
    expect(pill(container, 1)).not.toHaveAttribute("data-run-state");
    expect(pill(container, 2)).not.toHaveAttribute("data-run-state");
    // Companion arrows (4, 3) AND their pills disappear the instant the run begins.
    expect(arrow(container, 4)).toHaveAttribute("data-run-state", "hidden");
    expect(arrow(container, 3)).toHaveAttribute("data-run-state", "hidden");
    expect(pill(container, 4)).toHaveAttribute("data-run-state", "hidden");
    expect(pill(container, 3)).toHaveAttribute("data-run-state", "hidden");
    // The stage carries the running run-phase.
    expect(container.querySelector(".nor-stage")).toHaveAttribute("data-run-phase", "running");
  });

  it("after a run: selected arrows removed (pills kept), companion arrows + pills hidden", () => {
    const store = createRootStore();
    act(() => configureStrong(store.activeTrial));
    const { container } = renderStage("street", store);
    act(() => store.activeTrial.run()); // finalized (no running phase)

    expect(arrow(container, 1)).toHaveAttribute("data-run-state", "removed");
    expect(arrow(container, 2)).toHaveAttribute("data-run-state", "removed");
    expect(pill(container, 1)).not.toHaveAttribute("data-run-state"); // kept as the result marker
    expect(pill(container, 2)).not.toHaveAttribute("data-run-state");
    expect(arrow(container, 4)).toHaveAttribute("data-run-state", "hidden");
    expect(arrow(container, 3)).toHaveAttribute("data-run-state", "hidden");
    expect(pill(container, 4)).toHaveAttribute("data-run-state", "hidden");
    expect(pill(container, 3)).toHaveAttribute("data-run-state", "hidden");
    // A completed/restored trial carries the "done" run-phase.
    expect(container.querySelector(".nor-stage")).toHaveAttribute("data-run-phase", "done");
  });

  it("clears every run-state and the run-phase once the trial is reset", () => {
    const store = createRootStore();
    act(() => configureStrong(store.activeTrial));
    const { container } = renderStage("street", store);
    act(() => store.activeTrial.run());
    act(() => store.resetTrial());
    for (const el of container.querySelectorAll(".nor-arrow, .nor-pill")) {
      expect(el).not.toHaveAttribute("data-run-state");
    }
    expect(container.querySelector(".nor-stage")).not.toHaveAttribute("data-run-phase");
  });
});
