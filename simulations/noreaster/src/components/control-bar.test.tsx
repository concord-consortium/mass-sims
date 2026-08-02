import { Announcer } from "@concord-consortium/mass-sims-shared";
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The shared <Button> logs through lara-interactive-api's `log`; mock the transport so the disabled
// buttons don't reach the real API in jsdom, and so we can assert the explicitly-emitted events.
const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("@concord-consortium/lara-interactive-api", () => ({ log }));

import { createRootStore, type RootStoreInstance, RootStoreProvider } from "../stores/root-store";
import { configureStrong, STRONG_SETUP } from "../stores/test-helpers";
import { ControlBar } from "./control-bar";

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
    configureStrong(store.activeTrial);
    const { getByRole } = renderBar(store);
    expect(getByRole("button", { name: "Run" })).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("ControlBar — Run / Replay (deferred)", () => {
  it("on Run: enters the running phase (captures the outcome, disables Run) without recording it yet", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const { getByRole } = renderBar(store);
    fireEvent.click(getByRole("button", { name: "Run" }));

    // The outcome is captured on the run descriptor but not committed to the trial until the animation
    // finalizes, which the isolated control bar (no runner mounted) never reaches.
    expect(store.ui.isRunning("A")).toBe(true);
    expect(store.ui.run?.outcome).toBe("strong");
    expect(store.ui.run?.replay).toBe(false);
    expect(store.activeTrial.outcome).toBeNull();
    expect(getByRole("button", { name: "Run" })).toHaveAttribute("aria-disabled", "true");
    // The run START is logged here (the attempt); the paired `simulation_run` completion is the runner's
    // job at finalize, which the isolated bar (no runner mounted) never reaches.
    expect(log).toHaveBeenCalledWith("simulation_run_started", {
      trial: "A",
      replay: false,
      outcome: "strong",
      ...STRONG_SETUP,
    });
    expect(log).not.toHaveBeenCalledWith("simulation_run", expect.anything());
  });

  it("on Replay: re-enters the running phase with replay: true", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    store.activeTrial.run(); // already run → the button reads "Replay"
    const { getByRole } = renderBar(store);
    fireEvent.click(getByRole("button", { name: "Replay" }));
    expect(store.ui.isRunning("A")).toBe(true);
    expect(store.ui.run?.replay).toBe(true);
    expect(store.ui.run?.outcome).toBe("strong");
    expect(log).toHaveBeenCalledWith("simulation_run_started", {
      trial: "A",
      replay: true,
      outcome: "strong",
      ...STRONG_SETUP,
    });
  });

  it("Reset during a run cancels it, then clears the trial", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
    const { getByRole } = renderBar(store);
    fireEvent.click(getByRole("button", { name: "Run" }));
    expect(store.ui.isRunning("A")).toBe(true);

    fireEvent.click(getByRole("button", { name: "Reset Trial" }));
    expect(store.ui.run).toBeNull();
    expect(store.ui.isRunning("A")).toBe(false);
    expect(store.activeTrial.canReset).toBe(false);
    expect(log).toHaveBeenCalledWith("trial_reset", { trial: "A" });
  });
});

describe("ControlBar — Reset Trial", () => {
  it("disables Reset until the trial has any progress", () => {
    const { getByRole } = renderBar();
    expect(getByRole("button", { name: "Reset Trial" })).toHaveAttribute("aria-disabled", "true");
  });

  it("restores the trial: Replay → Run, Run disabled again, logs + announces", () => {
    const store = createRootStore();
    configureStrong(store.activeTrial);
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
