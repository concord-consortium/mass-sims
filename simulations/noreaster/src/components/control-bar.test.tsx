import { Announcer } from "@concord-consortium/mass-sims-shared";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The shared <Button> logs through lara-interactive-api's `log`; mock the transport so the disabled
// buttons don't reach the real API in jsdom, and so we can assert the explicitly-emitted events.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { createRootStore, type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { ControlBar } from "./control-bar";

/** Configure the active trial with a complete setup (this one maps to a strong nor'easter). */
function configure(store: RootStoreInstance) {
  const t = store.activeTrial;
  t.setLandPathway("N/NW");
  t.setLandHumidity("Dry");
  t.setLandTemperature("Cold");
  t.setOceanPathway("S/SE");
  t.setOceanHumidity("Humid");
}

function renderBar(store: RootStoreInstance = createRootStore()) {
  const onToggleMapView = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <RootStoreProvider store={store}>
      <Announcer>{children}</Announcer>
    </RootStoreProvider>
  );
  const utils = render(<ControlBar mapView="street" onToggleMapView={onToggleMapView} />, {
    wrapper,
  });
  const region = utils.container.querySelector('[aria-live="polite"]') as HTMLElement;
  return { store, onToggleMapView, region, ...utils };
}

describe("ControlBar — Run gating", () => {
  it("disables Run until the air-mass setup is complete", () => {
    const { getByRole } = renderBar();
    expect(getByRole("button", { name: "Run" })).toHaveAttribute("aria-disabled", "true");
  });

  it("enables Run once all five selections are made", () => {
    const store = createRootStore();
    configure(store);
    const { getByRole } = renderBar(store);
    expect(getByRole("button", { name: "Run" })).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("ControlBar — Run / Replay", () => {
  it("on Run: records the outcome, relabels to Replay, enables Reset, logs + announces", () => {
    const store = createRootStore();
    configure(store);
    const { getByRole, region } = renderBar(store);
    fireEvent.click(getByRole("button", { name: "Run" }));

    expect(store.activeTrial.outcome).toBe("strong");
    expect(getByRole("button", { name: "Replay" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Reset Trial" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(log).toHaveBeenCalledWith("simulation_run", {
      trial: "A",
      replay: false,
      outcome: "strong",
    });
    expect(region).toHaveTextContent(/Simulation complete: Strong nor/);
  });

  it("Replay re-runs the current trial and reports replay: true", () => {
    const store = createRootStore();
    configure(store);
    store.activeTrial.run();
    const { getByRole } = renderBar(store);
    log.mockClear();
    fireEvent.click(getByRole("button", { name: "Replay" }));
    expect(log).toHaveBeenCalledWith("simulation_run", {
      trial: "A",
      replay: true,
      outcome: "strong",
    });
  });
});

describe("ControlBar — Reset Trial", () => {
  it("disables Reset until the trial has any progress", () => {
    const { getByRole } = renderBar();
    expect(getByRole("button", { name: "Reset Trial" })).toHaveAttribute("aria-disabled", "true");
  });

  it("restores the trial: Replay → Run, Run disabled again, logs + announces", () => {
    const store = createRootStore();
    configure(store);
    store.activeTrial.run();
    const { getByRole, region } = renderBar(store);
    fireEvent.click(getByRole("button", { name: "Reset Trial" }));

    expect(store.activeTrial.canReset).toBe(false);
    expect(getByRole("button", { name: "Run" })).toHaveAttribute("aria-disabled", "true");
    expect(log).toHaveBeenCalledWith("trial_reset", { trial: "A" });
    expect(region).toHaveTextContent("Trial A reset.");
  });
});

describe("ControlBar — map-view toggle", () => {
  it("flips the basemap: calls onToggleMapView, logs map_view_changed, and announces", () => {
    const { getByRole, onToggleMapView, region } = renderBar();
    fireEvent.click(getByRole("switch", { name: "Map view: Street" }));
    expect(onToggleMapView).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("map_view_changed", { trial: "A", view: "satellite" });
    expect(region).toHaveTextContent(/Satellite view/);
  });

  it("also toggles on Enter (react-aria handles only Space for switches)", () => {
    const { getByRole, onToggleMapView } = renderBar();
    fireEvent.keyDown(getByRole("switch", { name: "Map view: Street" }), { key: "Enter" });
    expect(onToggleMapView).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("map_view_changed", { trial: "A", view: "satellite" });
  });
});
